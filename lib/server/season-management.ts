import type { ClientBase } from 'pg'

export type CompetitionKind = 'season' | 'tournament'

export interface StartedCompetition {
  seasonNumber: number
  name: string
  kind: CompetitionKind
}

export const DEFAULT_TOURNAMENT_DURATION_HOURS = 24
export const MIN_TOURNAMENT_DURATION_HOURS = 1
export const MAX_TOURNAMENT_DURATION_HOURS = 720
const LEGACY_TOURNAMENT_EDIT_HOURS = 48
const TOURNAMENT_SCHEMA_REQUIRED_MESSAGE =
  'Tournament mode needs database migrations 0020 through 0022. Ask an administrator to update the database, then try again.'

type Queryable = Pick<ClientBase, 'query'>

export async function competitionSchemaCapabilities(db: Queryable) {
  const result = await db.query(
    `select
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='seasons' and column_name='editable_until') as edit_windows,
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='seasons' and column_name='tournament_seconds_remaining')
       and exists (select 1 from information_schema.columns where table_schema='public' and table_name='clubs' and column_name='current_competition_number') as pausable,
       exists (select 1 from information_schema.columns where table_schema='public' and table_name='seasons' and column_name='tournament_duration_hours') as configurable`,
  )
  return {
    editWindows: Boolean(result.rows[0]?.edit_windows),
    pausable: Boolean(result.rows[0]?.pausable),
    configurable: Boolean(result.rows[0]?.configurable),
  }
}

function assertTournamentSchemaReady(capabilities: {
  editWindows: boolean
  pausable: boolean
  configurable: boolean
}) {
  if (!capabilities.editWindows || !capabilities.pausable || !capabilities.configurable)
    throw new Error(TOURNAMENT_SCHEMA_REQUIRED_MESSAGE)
}

export function competitionEditablePredicate(
  supportsEditWindows: boolean,
  alias = '',
  supportsPausableClock = false,
) {
  const prefix = alias ? `${alias}.` : ''
  const currentCompetition = supportsPausableClock
    ? ` and exists (select 1 from clubs competition_club where competition_club.id=${prefix}club_id and competition_club.current_competition_number=${prefix}season_number)`
    : ''
  return supportsEditWindows
    ? `(${prefix}active or (${prefix}competition_type='tournament'${currentCompetition} and ${prefix}editable_until > now()))`
    : `(${prefix}active or (${prefix}competition_type='tournament' and ${prefix}created_at > now() - interval '${LEGACY_TOURNAMENT_EDIT_HOURS} hours'))`
}

export async function assertClubCompetitionEditable(
  db: ClientBase,
  clubId: string,
  seasonNumber: number,
) {
  const capabilities = await competitionSchemaCapabilities(db)
  const editable = await db.query(
    `select 1 from seasons
     where club_id=$1 and season_number=$2
       and ${competitionEditablePredicate(capabilities.editWindows, '', capabilities.pausable)}`,
    [clubId, seasonNumber],
  )
  if (!editable.rowCount)
    throw new Error('That competition is read-only. A manager can reactivate its season or reopen its tournament from Settings.')
}

function normalizeTournamentName(value: string | undefined, fallback: string) {
  const name = value?.trim().replace(/\s+/g, ' ') || fallback
  if (name.length > 80) throw new Error('Tournament names must be 80 characters or fewer.')
  return name
}

export function normalizeTournamentDurationHours(value: unknown) {
  const duration = Number(value ?? DEFAULT_TOURNAMENT_DURATION_HOURS)
  if (!Number.isInteger(duration) || duration < MIN_TOURNAMENT_DURATION_HOURS || duration > MAX_TOURNAMENT_DURATION_HOURS)
    throw new Error(`Tournament duration must be a whole number from ${MIN_TOURNAMENT_DURATION_HOURS} to ${MAX_TOURNAMENT_DURATION_HOURS} hours.`)
  return duration
}

async function startNewClubCompetition(
  db: ClientBase,
  clubId: string,
  createdBy: string,
  kind: CompetitionKind,
  customName?: string,
  customDurationHours?: number,
): Promise<StartedCompetition> {
  const capabilities = await competitionSchemaCapabilities(db)
  if (kind === 'tournament') assertTournamentSchemaReady(capabilities)

  await db.query('select pg_advisory_xact_lock(hashtext($1))', [
    `session:${clubId}`,
  ])
  if (kind === 'tournament') {
    const runningTournament = await db.query(
      `select name from seasons
       where club_id=$1 and competition_type='tournament'
         and (
           (editable_until is not null and editable_until > now())
           or (editable_until is null and tournament_seconds_remaining > 0)
         )
       order by season_number desc
       limit 1`,
      [clubId],
    )
    if (runningTournament.rowCount) {
      const runningName = String(runningTournament.rows[0]?.name ?? 'The current tournament')
      throw new Error(`${runningName} must end before another tournament can start.`)
    }
  }
  const next = Number(
    (
      await db.query(
        'select coalesce(max(season_number),0)+1 next from seasons where club_id=$1',
        [clubId],
      )
    ).rows[0].next,
  )
  const nextKindNumber = Number(
    (
      await db.query(
        'select count(*)+1 next from seasons where club_id=$1 and competition_type=$2',
        [clubId, kind],
      )
    ).rows[0].next,
  )
  const defaultName = `${kind === 'tournament' ? 'Tournament' : 'Season'} ${nextKindNumber}`
  const name = kind === 'tournament'
    ? normalizeTournamentName(customName, defaultName)
    : defaultName
  const tournamentDurationHours = kind === 'tournament'
    ? normalizeTournamentDurationHours(customDurationHours)
    : null

  if (kind === 'season') {
    await db.query(
      'update sessions set is_active=false,closed_at=coalesce(closed_at,now()) where club_id=$1 and is_active',
      [clubId],
    )
    await db.query('update seasons set active=false where club_id=$1', [clubId])
    await db.query(
      capabilities.editWindows
        ? "insert into seasons(club_id,season_number,name,created_by,active,competition_type,editable_until) values($1,$2,$3,$4,true,$5,null)"
        : "insert into seasons(club_id,season_number,name,created_by,active,competition_type) values($1,$2,$3,$4,true,$5)",
      [clubId, next, name, createdBy, kind],
    )
    await db.query('update clubs set active_season_number=$1 where id=$2', [
      next,
      clubId,
    ])
    if (capabilities.pausable)
      await setClubCurrentCompetition(db, clubId, next)
  } else {
    await db.query(
      `insert into seasons(club_id,season_number,name,created_by,active,competition_type,editable_until,tournament_seconds_remaining,tournament_duration_hours)
       values($1,$2,$3,$4,false,$5,now()+make_interval(hours=>$6),$6*3600,$6)`,
      [clubId, next, name, createdBy, kind, tournamentDurationHours],
    )
    await setClubCurrentCompetition(db, clubId, next)
  }
  return { seasonNumber: next, name, kind }
}

export async function startNewClubSeason(
  db: ClientBase,
  clubId: string,
  createdBy: string,
) {
  return (await startNewClubCompetition(db, clubId, createdBy, 'season')).seasonNumber
}

export async function startNewClubTournament(
  db: ClientBase,
  clubId: string,
  createdBy: string,
  name?: string,
  durationHours?: number,
) {
  return startNewClubCompetition(db, clubId, createdBy, 'tournament', name, durationHours)
}

export async function setClubActiveSeason(
  db: ClientBase,
  clubId: string,
  seasonNumber: number,
) {
  await db.query('select pg_advisory_xact_lock(hashtext($1))', [
    `session:${clubId}`,
  ])
  const target = await db.query(
    "select 1 from seasons where club_id=$1 and season_number=$2 and competition_type='season'",
    [clubId, seasonNumber],
  )
  if (!target.rowCount) throw new Error('That regular season does not exist in this club.')

  const capabilities = await competitionSchemaCapabilities(db)
  const current = await db.query(
    capabilities.pausable
      ? `select c.active_season_number,c.current_competition_number,
           coalesce(s.competition_type,'season') current_competition_type
         from clubs c
         left join seasons s on s.club_id=c.id and s.season_number=c.current_competition_number
         where c.id=$1 for update of c`
      : "select active_season_number,active_season_number current_competition_number,'season'::text current_competition_type from clubs where id=$1 for update",
    [clubId],
  )
  if (!current.rowCount) throw new Error('Club not found.')
  const changingSeason = Number(current.rows[0].active_season_number) !== seasonNumber
  const tournamentRemainsCurrent = current.rows[0].current_competition_type === 'tournament'
  if (changingSeason && !tournamentRemainsCurrent)
    await db.query(
      'update sessions set is_active=false,closed_at=coalesce(closed_at,now()) where club_id=$1 and is_active',
      [clubId],
    )

  await db.query(
    "update seasons set active=(season_number=$1 and competition_type='season') where club_id=$2",
    [seasonNumber, clubId],
  )
  await db.query('update clubs set active_season_number=$1 where id=$2', [
    seasonNumber,
    clubId,
  ])
  if (capabilities.pausable && !tournamentRemainsCurrent)
    await setClubCurrentCompetition(db, clubId, seasonNumber)
}

export async function setClubCurrentCompetition(
  db: ClientBase,
  clubId: string,
  seasonNumber: number,
) {
  const capabilities = await competitionSchemaCapabilities(db)
  if (!capabilities.editWindows || !capabilities.pausable || !capabilities.configurable) {
    const target = (await db.query(
      'select competition_type from seasons where club_id=$1 and season_number=$2',
      [clubId, seasonNumber],
    )).rows[0]
    if (!target) throw new Error('That competition no longer exists.')
    if (target.competition_type === 'tournament')
      assertTournamentSchemaReady(capabilities)
    // Before migration 0021, the active regular season is implicitly current.
    return
  }
  await db.query('select pg_advisory_xact_lock(hashtext($1))', [`competition:${clubId}`])
  const club = (await db.query(
    'select active_season_number,current_competition_number from clubs where id=$1 for update',
    [clubId],
  )).rows[0]
  if (!club) throw new Error('Club not found.')
  const target = (await db.query(
    'select competition_type,tournament_seconds_remaining,tournament_duration_hours from seasons where club_id=$1 and season_number=$2 for update',
    [clubId, seasonNumber],
  )).rows[0]
  if (!target) throw new Error('That competition no longer exists.')
  if (target.competition_type === 'season' && Number(club.active_season_number) !== seasonNumber)
    throw new Error('Only the active regular season can be made current.')

  const currentNumber = Number(club.current_competition_number ?? club.active_season_number)
  if (currentNumber === seasonNumber) return
  await db.query(
    `update seasons
     set tournament_seconds_remaining=greatest(0,extract(epoch from (editable_until-now()))::integer),
         editable_until=null
     where club_id=$1 and season_number=$2 and competition_type='tournament' and editable_until is not null`,
    [clubId, currentNumber],
  )
  if (target.competition_type === 'tournament') {
    const remaining = Number(target.tournament_seconds_remaining ?? Number(target.tournament_duration_hours ?? DEFAULT_TOURNAMENT_DURATION_HOURS) * 60 * 60)
    if (remaining <= 0)
      throw new Error('That tournament clock has expired. Reopen it from Settings first.')
    await db.query(
      "update seasons set editable_until=now()+make_interval(secs=>tournament_seconds_remaining) where club_id=$1 and season_number=$2",
      [clubId, seasonNumber],
    )
  }
  await db.query('update clubs set current_competition_number=$1 where id=$2', [seasonNumber, clubId])
}

export async function reopenClubTournament(
  db: ClientBase,
  clubId: string,
  seasonNumber: number,
) {
  const capabilities = await competitionSchemaCapabilities(db)
  assertTournamentSchemaReady(capabilities)
  const updated = await db.query(
    `update seasons set editable_until=now()+make_interval(hours=>coalesce(tournament_duration_hours,${DEFAULT_TOURNAMENT_DURATION_HOURS})),
       tournament_seconds_remaining=coalesce(tournament_duration_hours,${DEFAULT_TOURNAMENT_DURATION_HOURS})*3600
     where club_id=$1 and season_number=$2 and competition_type='tournament'`,
    [clubId, seasonNumber],
  )
  if (!updated.rowCount) throw new Error('That tournament no longer exists.')
  await setClubCurrentCompetition(db, clubId, seasonNumber)
}

export async function updateClubTournamentDuration(
  db: ClientBase,
  clubId: string,
  seasonNumber: number,
  durationHours: number,
) {
  const capabilities = await competitionSchemaCapabilities(db)
  assertTournamentSchemaReady(capabilities)
  const duration = normalizeTournamentDurationHours(durationHours)
  await db.query('select pg_advisory_xact_lock(hashtext($1))', [`competition:${clubId}`])
  const updated = await db.query(
    `update seasons s
     set tournament_duration_hours=$3,
         tournament_seconds_remaining=case
           when s.tournament_duration_hours is distinct from $3
             and ((s.editable_until is not null and s.editable_until > now())
               or (s.editable_until is null and s.tournament_seconds_remaining > 0)) then $3*3600
           else s.tournament_seconds_remaining
         end,
         editable_until=case
           when s.tournament_duration_hours is not distinct from $3 then s.editable_until
           when c.current_competition_number=s.season_number and s.editable_until > now() then now()+make_interval(hours=>$3)
           else s.editable_until
         end
     from clubs c
     where s.club_id=$1 and s.season_number=$2 and s.competition_type='tournament' and c.id=s.club_id`,
    [clubId, seasonNumber, duration],
  )
  if (!updated.rowCount) throw new Error('That tournament no longer exists.')
}

export async function endClubTournament(
  db: ClientBase,
  clubId: string,
  seasonNumber: number,
) {
  const capabilities = await competitionSchemaCapabilities(db)
  assertTournamentSchemaReady(capabilities)
  await db.query('select pg_advisory_xact_lock(hashtext($1))', [`competition:${clubId}`])
  const club = (await db.query(
    'select active_season_number,current_competition_number from clubs where id=$1 for update',
    [clubId],
  )).rows[0]
  if (!club) throw new Error('Club not found.')
  const ended = await db.query(
    `update seasons
     set editable_until=null,tournament_seconds_remaining=0
     where club_id=$1 and season_number=$2 and competition_type='tournament'`,
    [clubId, seasonNumber],
  )
  if (!ended.rowCount) return
  if (Number(club.current_competition_number) === seasonNumber) {
    await db.query(
      'update clubs set current_competition_number=active_season_number where id=$1',
      [clubId],
    )
  }
}

export async function deleteClubTournament(
  db: ClientBase,
  clubId: string,
  seasonNumber: number,
) {
  await db.query('select pg_advisory_xact_lock(hashtext($1))', [`session:${clubId}`])
  const capabilities = await competitionSchemaCapabilities(db)
  const target = await db.query(
    capabilities.pausable
      ? `select s.active,c.current_competition_number,
           ((s.editable_until is not null and s.editable_until > now())
             or (s.editable_until is null and s.tournament_seconds_remaining > 0)) as tournament_unfinished
         from seasons s join clubs c on c.id=s.club_id
         where s.club_id=$1 and s.season_number=$2 and s.competition_type='tournament'
         for update of s,c`
      : "select active from seasons where club_id=$1 and season_number=$2 and competition_type='tournament' for update",
    [clubId, seasonNumber],
  )
  if (!target.rowCount) return
  if (target.rows[0].active)
    throw new Error('Set a regular season as current before deleting this tournament.')
  if (Number(target.rows[0].current_competition_number) === seasonNumber)
    throw new Error('Switch to the active regular season before deleting this tournament.')
  if (target.rows[0].tournament_unfinished)
    throw new Error('End the tournament before deleting it.')
  await db.query('delete from sessions where club_id=$1 and season_number=$2', [clubId, seasonNumber])
  await db.query('delete from games where club_id=$1 and season_number=$2', [clubId, seasonNumber])
  await db.query(
    "delete from seasons where club_id=$1 and season_number=$2 and competition_type='tournament'",
    [clubId, seasonNumber],
  )
}
