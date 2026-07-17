import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

const connectionString =
  process.env.APP_DATABASE_URL || process.env.SUPABASE_DATABASE_URL

describe.skipIf(!connectionString)('safe account deletion', () => {
  it('requires a manager resolution, transfers the club, and preserves anonymized game history', async () => {
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
    await client.connect()
    await client.query('begin')
    try {
      const suffix = randomUUID().replace(/-/g, '').slice(0, 12)
      const clubId = `A${suffix.slice(0, 5)}`.toUpperCase()
      const departingUid = `departing-${suffix}`
      const successorUid = `successor-${suffix}`
      const playerId = `player-${suffix}`
      const gameId = `game-${suffix}`

      await client.query(
        `insert into user_profiles(firebase_uid,display_name) values
          ($1,'Departing User'),($2,'Successor User')`,
        [departingUid, successorUid],
      )
      await client.query(
        'insert into clubs(id,name,manager_uid,manager_display_name) values($1,$2,$3,$4)',
        [clubId, 'Account Deletion Test', departingUid, 'Departing User'],
      )
      await client.query(
        `insert into club_members(club_id,firebase_uid,display_name,role) values
          ($1,$2,'Departing User','manager'),($1,$3,'Successor User','member')`,
        [clubId, departingUid, successorUid],
      )
      await client.query(
        "insert into seasons(club_id,season_number,name,created_by) values($1,1,'Season 1',$2)",
        [clubId, departingUid],
      )
      await client.query(
        "insert into players(id,club_id,display_name,icon,auth_uid) values($1,$2,'Roster Player','🀄',$3)",
        [playerId, clubId, departingUid],
      )
      await client.query(
        "insert into games(id,club_id,created_by,win_type) values($1,$2,$3,'draw')",
        [gameId, clubId, departingUid],
      )
      await client.query(
        'insert into game_entries(game_id,player_id,score) values($1,$2,0)',
        [gameId, playerId],
      )
      await client.query("select set_config('app.actor_uid', $1, true)", [departingUid])

      await expect(
        client.query(
          "select public.delete_user_data_safely($1,'{}'::jsonb)",
          [departingUid],
        ),
      ).rejects.toThrow(/Choose a manager handoff or club deletion/)

      // Clear the failed statement while retaining the rollback-only fixture.
      await client.query('rollback')
      await client.query('begin')

      await client.query(
        `insert into user_profiles(firebase_uid,display_name) values
          ($1,'Departing User'),($2,'Successor User')`,
        [departingUid, successorUid],
      )
      await client.query(
        'insert into clubs(id,name,manager_uid,manager_display_name) values($1,$2,$3,$4)',
        [clubId, 'Account Deletion Test', departingUid, 'Departing User'],
      )
      await client.query(
        `insert into club_members(club_id,firebase_uid,display_name,role) values
          ($1,$2,'Departing User','manager'),($1,$3,'Successor User','member')`,
        [clubId, departingUid, successorUid],
      )
      await client.query(
        "insert into seasons(club_id,season_number,name,created_by) values($1,1,'Season 1',$2)",
        [clubId, departingUid],
      )
      await client.query(
        "insert into players(id,club_id,display_name,icon,auth_uid) values($1,$2,'Roster Player','🀄',$3)",
        [playerId, clubId, departingUid],
      )
      await client.query(
        "insert into games(id,club_id,created_by,win_type) values($1,$2,$3,'draw')",
        [gameId, clubId, departingUid],
      )
      await client.query(
        'insert into game_entries(game_id,player_id,score) values($1,$2,0)',
        [gameId, playerId],
      )
      await client.query("select set_config('app.actor_uid', $1, true)", [departingUid])
      await client.query(
        'select public.delete_user_data_safely($1,$2::jsonb)',
        [departingUid, JSON.stringify({
          [clubId]: { action: 'transfer', successorUid },
        })],
      )

      const result = await client.query(
        `select
          (select manager_uid from clubs where id=$1) manager_uid,
          (select role::text from club_members where club_id=$1 and firebase_uid=$2) successor_role,
          (select count(*)::int from club_members where firebase_uid=$3) departing_memberships,
          (select auth_uid from players where id=$4) player_auth_uid,
          (select count(*)::int from game_entries where game_id=$5) game_entries,
          (select created_by from games where id=$5) game_created_by,
          (select count(*)::int from user_profiles where firebase_uid=$3) departing_profiles,
          (select count(*)::int from user_profiles where firebase_uid=$2) successor_profiles`,
        [clubId, successorUid, departingUid, playerId, gameId],
      )
      expect(result.rows[0]).toEqual({
        manager_uid: successorUid,
        successor_role: 'manager',
        departing_memberships: 0,
        player_auth_uid: null,
        game_entries: 1,
        game_created_by: 'deleted-user',
        departing_profiles: 0,
        successor_profiles: 1,
      })
    } finally {
      await client.query('rollback')
      await client.end()
    }
  }, 30_000)
})
