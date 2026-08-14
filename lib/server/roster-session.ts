import type { ClientBase } from 'pg'

export async function addPlayerToActiveSession(
  db: ClientBase,
  clubId: string,
  playerId: string,
) {
  await db.query('select pg_advisory_xact_lock(hashtext($1))', [
    `session:${clubId}`,
  ])
  const updated = await db.query(
    `update sessions
     set participants = case
           when $2=any(participants) then participants
           else array_append(participants,$2)
         end,
         sideline = case
           when $2=any(participants) or $2=any(sideline) then sideline
           else array_append(sideline,$2)
         end,
         revision = revision + case when $2=any(participants) then 0 else 1 end
     where club_id=$1 and is_active
     returning id`,
    [clubId, playerId],
  )
  return Boolean(updated.rowCount)
}
