import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { setClubActiveSeason, startNewClubSeason } from '@/lib/server/season-management'

const connectionString = process.env.SUPABASE_DATABASE_URL

describe.skipIf(!connectionString)('season lifecycle database transaction', () => {
  it('rolls forward atomically, closes the live session, and preserves historical games', async () => {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
    await client.connect()
    await client.query('begin')
    try {
      const clubId = `T${randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase()}`
      await client.query("insert into clubs(id,name,manager_uid) values($1,'Season test','manager-test')", [clubId])
      await client.query("insert into seasons(club_id,season_number,name,created_by,active) values($1,1,'Season 1','manager-test',true)", [clubId])
      await client.query("insert into sessions(club_id,created_by,season_number,table_count) values($1,'manager-test',1,1)", [clubId])
      const game = await client.query("insert into games(club_id,created_by,season_number,win_type) values($1,'manager-test',1,'draw') returning id", [clubId])

      const next = await startNewClubSeason(client, clubId, 'manager-test')
      expect(next).toBe(2)

      const state = await client.query(`select
        (select active_season_number from clubs where id=$1)::int active_season,
        (select count(*)::int from seasons where club_id=$1 and active) active_seasons,
        (select count(*)::int from sessions where club_id=$1 and is_active) active_sessions,
        (select count(*)::int from sessions where club_id=$1 and season_number=1 and closed_at is not null) closed_old_sessions,
        (select count(*)::int from games where id=$2 and season_number=1) historical_games`, [clubId, game.rows[0].id])
      expect(state.rows[0]).toEqual({
        active_season: 2,
        active_seasons: 1,
        active_sessions: 0,
        closed_old_sessions: 1,
        historical_games: 1,
      })

      await setClubActiveSeason(client, clubId, 1)
      const restored = await client.query('select active_season_number from clubs where id=$1', [clubId])
      const flags = await client.query('select season_number,active from seasons where club_id=$1 order by season_number', [clubId])
      expect(Number(restored.rows[0].active_season_number)).toBe(1)
      expect(flags.rows).toEqual([
        { season_number: 1, active: true },
        { season_number: 2, active: false },
      ])
    } finally {
      await client.query('rollback')
      await client.end()
    }
  }, 20_000)
})
