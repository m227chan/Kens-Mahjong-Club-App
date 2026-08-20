import { describe, expect, it } from 'vitest'
import { Timestamp } from '@/lib/timestamp'
import { activePlayerIds, aggregateAllCompetitionStats, aggregatePlayerGames, boundsForPreset, combinedCompetitionSkillEvents, defaultComparedPlayerIds, gamesInBounds, playerCompetitionRecords, subtractCalendarMonths, toggleComparedPlayerId } from '@/lib/standings-analytics'
import type { GameDoc, PlayerDoc, PlayerStatsDoc, SkillEventDoc } from '@/lib/types'

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

  it('calculates competition-wide player records from every game and Skill event', () => {
    const games = [
      game('a', '2026-01-01', 'self_draw', 'p', { p: 10, q: -10 }),
      game('b', '2026-01-02', 'discard', 'q', { p: -25, q: 25 }),
      game('c', '2026-01-03', 'self_draw', 'p', { p: 40, q: -40 }),
      game('d', '2026-01-04', 'discard', 'q', { p: -5, q: 5 }),
    ]
    const skillEvents = [
      { playerId: 'p', ratingBefore: 1500, ratingAfter: 1530 },
      { playerId: 'p', ratingBefore: 1530, ratingAfter: 1475 },
      { playerId: 'q', ratingBefore: 2000, ratingAfter: 2100 },
    ] as SkillEventDoc[]

    expect(playerCompetitionRecords(games, skillEvents, 'p')).toEqual({
      maximumCumulativePoints: 25,
      minimumCumulativePoints: -15,
      highestSingleGameWin: 40,
      worstSingleGameLoss: -25,
      peakSkillRating: 1530,
      lowestSkillRating: 1475,
    })
  })

  it('combines regular seasons and tournaments into one continuous club view', () => {
    const seasonGame = { ...game('season', '2026-01-01', 'self_draw', 'p', { p: 10, q: -10 }), seasonNumber: 1 }
    const tournamentGame = { ...game('tournament', '2026-02-01', 'discard', 'p', { p: 20, q: -20 }), seasonNumber: 2 }
    const games = [seasonGame, tournamentGame]
    const events = combinedCompetitionSkillEvents(games)
    const stats = aggregateAllCompetitionStats(games)
    const player = stats.find((row) => row.playerId === 'p')

    expect(events).toHaveLength(4)
    expect(events.filter((event) => event.playerId === 'p')[1].ratingBefore).toBe(events.filter((event) => event.playerId === 'p')[0].ratingAfter)
    expect(player).toMatchObject({
      totalPoints: 30,
      gamesPlayed: 2,
      gamesWon: 2,
      gamesLost: 0,
      skillGamesPlayed: 2,
      pointsRank: 1,
      skillRank: 1,
      recentPointTrend: [10, 30],
      daysAttended: 2,
    })
    expect(stats.find((row) => row.playerId === 'q')).toMatchObject({ totalPoints: -30, pointsRank: 2 })
  })

  it('returns empty record values when a player has no competition history', () => {
    expect(playerCompetitionRecords([], [], 'p')).toEqual({
      maximumCumulativePoints: null,
      minimumCumulativePoints: null,
      highestSingleGameWin: null,
      worstSingleGameLoss: null,
      peakSkillRating: null,
      lowestSkillRating: null,
    })
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
