import { describe, expect, it } from 'vitest'
import { Timestamp } from '@/lib/timestamp'
import { activePlayerIds, aggregatePlayerGames, boundsForPreset, defaultComparedPlayerIds, gamesInBounds, subtractCalendarMonths, toggleComparedPlayerId } from '@/lib/standings-analytics'
import type { GameDoc, PlayerDoc, PlayerStatsDoc } from '@/lib/types'

const game = (id: string, date: string, winType: GameDoc['winType'], winnerPlayerId: string | null, scores: Record<string, number>): GameDoc => ({
  id,
  datetime: Timestamp.fromDate(new Date(date)),
  createdBy: 'test',
  tableId: null,
  entries: Object.entries(scores).map(([playerId, score]) => ({ playerId, score })),
  winType,
  winnerPlayerId,
  loserPlayerId: null,
  fan: null,
  notes: null,
})

describe('standings analytics', () => {
  it('subtracts calendar months without overflowing short months', () => {
    expect(subtractCalendarMonths(new Date(2026, 4, 31), 3).toISOString().slice(0, 10)).toBe('2026-02-28')
  })

  it('uses inclusive custom date bounds', () => {
    const games = [game('a', '2026-01-01T12:00:00', 'draw', null, { p: 0 }), game('b', '2026-01-02T00:00:00', 'draw', null, { p: 0 })]
    expect(gamesInBounds(games, boundsForPreset('custom', new Date(), '2026-01-01', '2026-01-01')).map((item) => item.id)).toEqual(['a'])
  })

  it('aggregates wins by type and builds a cumulative point trend', () => {
    const rows = aggregatePlayerGames([
      game('a', '2026-01-01', 'self_draw', 'p', { p: 12, q: -12 }),
      game('b', '2026-01-02', 'discard', 'p', { p: 8, q: -8 }),
      game('c', '2026-01-03', 'draw', null, { p: 0, q: 0 }),
    ])
    expect(rows.get('p')).toMatchObject({ totalPoints: 20, gamesPlayed: 3, gamesWon: 2, gamesLost: 0, selfDrawWins: 1, discardWins: 1, draws: 1, pointTrend: [12, 20, 20] })
  })

  it('defines active players from any game inside the configured calendar window', () => {
    const games = [game('old', '2026-04-11', 'draw', null, { old: 0 }), game('new', '2026-04-13', 'draw', null, { active: 0 })]
    expect([...activePlayerIds(games, 3, new Date('2026-07-12T12:00:00'))]).toEqual(['active'])
  })

  it('defaults comparisons to the linked player plus the four strongest Skill ratings', () => {
    const players = ['a', 'b', 'c', 'd', 'e', 'linked'].map((id) => ({ id, displayName: id, active: true } as PlayerDoc))
    const stats = ['a', 'b', 'c', 'd', 'e', 'linked'].map((id, index) => ({ playerId: id, skillRating: 2000 - index * 100 } as PlayerStatsDoc))
    expect(defaultComparedPlayerIds(players, stats, 'linked')).toEqual(['linked', 'a', 'b', 'c', 'd'])
    expect(defaultComparedPlayerIds(players, stats, null)).toEqual(['a', 'b', 'c', 'd', 'e'])
  })

  it('never adds a sixth comparison player but still allows removals', () => {
    const selected = ['a', 'b', 'c', 'd', 'e']
    expect(toggleComparedPlayerId(selected, 'f')).toEqual(selected)
    expect(toggleComparedPlayerId(selected, 'c')).toEqual(['a', 'b', 'd', 'e'])
  })
})
