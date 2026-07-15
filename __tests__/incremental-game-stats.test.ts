import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { applyNewGame, storedStats } from '@/lib/server/supabase-game-management'

describe('incremental game stats', () => {
  const entries = [
    { playerId: 'a', score: 24 },
    { playerId: 'b', score: -8 },
    { playerId: 'c', score: -8 },
    { playerId: 'd', score: -8 }
  ]
  let stats: Map<string, ReturnType<typeof storedStats>>

  beforeEach(() => {
    stats = new Map(entries.map((entry) => [entry.playerId, storedStats({ player_id: entry.playerId }, 1500)]))
  })

  it('advances only the supplied players without replaying history', () => {
    const game = {
      id: 'game-1', datetime: new Date('2026-07-14T20:00:00Z'), createdBy: 'member', seasonNumber: 2, entries,
      winnerPlayerId: 'a', isHistorical: false, winType: 'self_draw' as const
    } as Parameters<typeof applyNewGame>[1]

    const result = applyNewGame(stats, game, { eloStartingRating: 1500 })

    expect(result.eloResults).toHaveLength(4)
    expect(result.skillResults).toHaveLength(4)
    expect(stats.get('a')).toMatchObject({ totalPoints: 24, gamesPlayed: 1, gamesWon: 1, gamesLost: 0, skillGamesPlayed: 1, daysAttended: 1 })
    expect(stats.get('b')).toMatchObject({ totalPoints: -8, gamesPlayed: 1, gamesWon: 0, gamesLost: 1, skillGamesPlayed: 1, daysAttended: 1 })
  })

  it('preserves rolling deltas and counts one attendance day for same-day games', () => {
    const game = (id: string, datetime: string) => ({
      id, datetime: new Date(datetime), createdBy: 'member', seasonNumber: 2, entries,
      winnerPlayerId: 'a', isHistorical: false, winType: 'self_draw' as const
    }) as Parameters<typeof applyNewGame>[1]

    applyNewGame(stats, game('game-1', '2026-07-14T20:00:00Z'), {})
    applyNewGame(stats, game('game-2', '2026-07-14T21:00:00Z'), {})

    expect(stats.get('a')).toMatchObject({ totalPoints: 48, gamesPlayed: 2, gamesWon: 2, skillGamesPlayed: 2, daysAttended: 1 })
    expect(stats.get('a')?.recentEloDeltas).toHaveLength(2)
    expect(stats.get('a')?.recentSkillDeltas).toHaveLength(2)
  })
})
