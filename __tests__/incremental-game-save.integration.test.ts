import { randomUUID } from 'node:crypto'
import { Client, type PoolClient } from 'pg'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { appendNewGame, insertGame, rebuild } from '@/lib/server/supabase-game-management'

const connectionString = process.env.SUPABASE_DATABASE_URL

describe.skipIf(!connectionString)('incremental game save database transaction', () => {
  it('writes a bounded set of rows and makes a retry idempotent', async () => {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
    await client.connect()
    await client.query('begin')
    try {
      const fixture = await client.query(`select c.id club_id, s.season_number,
        (select array_agg(id order by id) from (select id from players where club_id=c.id and active order by id limit 4) p) player_ids
        from clubs c join seasons s on s.club_id=c.id where c.active order by c.id,s.season_number desc limit 1`)
      const row = fixture.rows.find((value) => Array.isArray(value.player_ids) && value.player_ids.length === 4)
      expect(row).toBeTruthy()
      const [winner, ...others] = row.player_ids as string[]
      const entries = [{ playerId: winner, score: 24 }, ...others.map((playerId) => ({ playerId, score: -8 }))]
      const key = `integration-${randomUUID()}`
      await client.query('select pg_advisory_xact_lock(hashtext($1))', [`games:${row.club_id}`])
      const before = await client.query('select count(*)::int games from games where club_id=$1', [row.club_id])
      let statements = 0
      const countedClient = new Proxy(client, {
        get(target, property) {
          if (property !== 'query') return Reflect.get(target, property, target)
          return (...args: unknown[]) => { statements += 1; return Reflect.apply(target.query, target, args) }
        }
      }) as unknown as PoolClient

      const inserted = await insertGame(countedClient, row.club_id, { entries, seasonNumber: row.season_number, winType: 'self_draw', idempotencyKey: key }, 'integration-test')
      expect(inserted.created).toBe(true)
      if (!inserted.created) throw new Error('Expected the integration game to be new.')
      await appendNewGame(countedClient, row.club_id, inserted.game)

      const retried = await insertGame(countedClient, row.club_id, { entries, seasonNumber: row.season_number, winType: 'self_draw', idempotencyKey: key }, 'integration-test')
      const after = await client.query(`select
        (select count(*)::int from games where club_id=$1) games,
        (select count(*)::int from game_entries where game_id=$2) entries,
        (select count(*)::int from elo_events where game_id=$2) elo_events,
        (select count(*)::int from skill_events where game_id=$2) skill_events`, [row.club_id, inserted.gameId])

      expect(retried).toEqual({ gameId: inserted.gameId, created: false })
      expect(statements).toBe(11)
      expect(after.rows[0]).toMatchObject({ games: before.rows[0].games + 1, entries: 4, elo_events: 4, skill_events: 4 })

      const comparableStats = async () => (await client.query(`select 'all' scope,player_id,total_points,games_played,games_won,games_lost,win_loss_ratio,best_single_game,worst_single_game,elo_rating,elo_peak,elo_games_played,last5_elo_delta,recent_elo_deltas,skill_mu,skill_sigma,skill_rating,skill_peak,skill_games_played,last5_skill_delta,recent_skill_deltas,days_attended,last_played_at
        from player_stats where club_id=$1 and player_id=any($2::text[])
        union all
        select 'season' scope,player_id,total_points,games_played,games_won,games_lost,win_loss_ratio,best_single_game,worst_single_game,elo_rating,elo_peak,elo_games_played,last5_elo_delta,recent_elo_deltas,skill_mu,skill_sigma,skill_rating,skill_peak,skill_games_played,last5_skill_delta,recent_skill_deltas,days_attended,last_played_at
        from season_player_stats where club_id=$1 and season_number=$3 and player_id=any($2::text[]) order by scope,player_id`, [row.club_id, row.player_ids, row.season_number])).rows
      const normalized = (value: unknown) => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'number' ? Number(item.toFixed(10)) : item))
      const incrementalStats = normalized(await comparableStats())
      await rebuild(client, row.club_id)
      expect(normalized(await comparableStats())).toEqual(incrementalStats)
    } finally {
      await client.query('rollback')
      await client.end()
    }
  }, 20_000)
})
