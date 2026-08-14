import type { ClientBase } from 'pg'

export async function startNewClubSeason(
  db: ClientBase,
  clubId: string,
  createdBy: string,
) {
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
  await db.query(
    'update sessions set is_active=false,closed_at=coalesce(closed_at,now()) where club_id=$1 and is_active',
    [clubId],
  )
  await db.query('update seasons set active=false where club_id=$1', [clubId])
  await db.query(
    'insert into seasons(club_id,season_number,name,created_by,active) values($1,$2,$3,$4,true)',
    [clubId, next, `Season ${next}`, createdBy],
  )
  await db.query('update clubs set active_season_number=$1 where id=$2', [
    next,
    clubId,
  ])
  return next
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
