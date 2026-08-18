import type { ClientBase } from 'pg'

export type CompetitionKind = 'season' | 'tournament'

export interface StartedCompetition {
  seasonNumber: number
  name: string
  kind: CompetitionKind
}

function normalizeTournamentName(value: string | undefined, fallback: string) {
  const name = value?.trim().replace(/\s+/g, ' ') || fallback
  if (name.length > 80) throw new Error('Tournament names must be 80 characters or fewer.')
  return name
}

async function startNewClubCompetition(
  db: ClientBase,
  clubId: string,
  createdBy: string,
  kind: CompetitionKind,
  customName?: string,
): Promise<StartedCompetition> {
  await db.query('select pg_advisory_xact_lock(hashtext($1))', [
    `session:${clubId}`,
  ])
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

  await db.query(
    'update sessions set is_active=false,closed_at=coalesce(closed_at,now()) where club_id=$1 and is_active',
    [clubId],
  )
  await db.query('update seasons set active=false where club_id=$1', [clubId])
  await db.query(
    'insert into seasons(club_id,season_number,name,created_by,active,competition_type) values($1,$2,$3,$4,true,$5)',
    [clubId, next, name, createdBy, kind],
  )
  await db.query('update clubs set active_season_number=$1 where id=$2', [
    next,
    clubId,
  ])
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
) {
  return startNewClubCompetition(db, clubId, createdBy, 'tournament', name)
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
    'select 1 from seasons where club_id=$1 and season_number=$2',
    [clubId, seasonNumber],
  )
  if (!target.rowCount) throw new Error('That season does not exist in this club.')

  await db.query(
    'update seasons set active=(season_number=$1) where club_id=$2',
    [seasonNumber, clubId],
  )
  await db.query('update clubs set active_season_number=$1 where id=$2', [
    seasonNumber,
    clubId,
  ])
}
