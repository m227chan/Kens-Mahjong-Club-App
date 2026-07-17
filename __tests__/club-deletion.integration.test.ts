import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

const connectionString =
  process.env.APP_DATABASE_URL || process.env.SUPABASE_DATABASE_URL

describe.skipIf(!connectionString)('permanent club deletion', () => {
  it('cascades club data, clears its audit history, and preserves the user profile', async () => {
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
    await client.connect()
    await client.query('begin')
    try {
      const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
      const clubId = `D${suffix.slice(0, 5)}`.toUpperCase()
      const uid = `delete-test-${suffix}`
      const playerId = `player-${suffix}`
      const gameId = `game-${suffix}`

      await client.query(
        'insert into user_profiles(firebase_uid,display_name) values($1,$2)',
        [uid, 'Deletion Test'],
      )
      await client.query(
        'insert into clubs(id,name,manager_uid) values($1,$2,$3)',
        [clubId, 'Deletion Test Club', uid],
      )
      await client.query(
        "insert into club_members(club_id,firebase_uid,role) values($1,$2,'manager')",
        [clubId, uid],
      )
      await client.query(
        "insert into seasons(club_id,season_number,name,created_by) values($1,1,'Season 1',$2)",
        [clubId, uid],
      )
      await client.query(
        "insert into players(id,club_id,display_name,icon) values($1,$2,'Player','🀄')",
        [playerId, clubId],
      )
      await client.query(
        "insert into games(id,club_id,created_by,win_type) values($1,$2,$3,'draw')",
        [gameId, clubId, uid],
      )
      await client.query(
        'insert into game_entries(game_id,player_id,score) values($1,$2,0)',
        [gameId, playerId],
      )
      await client.query("select set_config('app.actor_uid', $1, true)", [uid])

      await client.query('select public.delete_club_permanently($1)', [clubId])

      const remaining = await client.query(
        `select
          (select count(*)::int from clubs where id=$1) clubs,
          (select count(*)::int from club_members where club_id=$1) members,
          (select count(*)::int from players where club_id=$1) players,
          (select count(*)::int from games where club_id=$1) games,
          (select count(*)::int from game_entries where game_id=$2) entries,
          (select count(*)::int from game_audit_log where club_id=$1 or row_id like $2 || '%') audit_rows,
          (select count(*)::int from user_profiles where firebase_uid=$3) user_profiles`,
        [clubId, gameId, uid],
      )
      expect(remaining.rows[0]).toEqual({
        clubs: 0,
        members: 0,
        players: 0,
        games: 0,
        entries: 0,
        audit_rows: 0,
        user_profiles: 1,
      })

      const foreignKeys = await client.query(`
        select conrelid::regclass::text as table_name, confdeltype
        from pg_constraint
        where contype = 'f' and confrelid = 'public.clubs'::regclass
      `)
      expect(foreignKeys.rows.length).toBeGreaterThan(0)
      expect(foreignKeys.rows.every((row) => row.confdeltype === 'c')).toBe(true)
    } finally {
      await client.query('rollback')
      await client.end()
    }
  }, 20_000)

  it('refuses to delete the universal club even when the actor is its manager', async () => {
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
    await client.connect()
    await client.query('begin')
    try {
      const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
      const clubId = `U${suffix.slice(0, 5)}`.toUpperCase()
      const uid = `universal-delete-test-${suffix}`

      await client.query(
        'insert into clubs(id,name,manager_uid,universal) values($1,$2,$3,true)',
        [clubId, 'Protected Universal Test Club', uid],
      )
      await client.query(
        "insert into club_members(club_id,firebase_uid,role) values($1,$2,'manager')",
        [clubId, uid],
      )
      await client.query("select set_config('app.actor_uid', $1, true)", [uid])

      await expect(
        client.query('select public.delete_club_permanently($1)', [clubId]),
      ).rejects.toThrow('The universal club cannot be deleted.')
    } finally {
      await client.query('rollback')
      await client.end()
    }
  }, 20_000)
})
