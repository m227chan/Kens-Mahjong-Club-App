import { describe, expect, it } from 'vitest'
import {
  assignTitle,
  calculateRoundEloDeltas,
  computeGlobalRanks,
  type TitleBand
} from '../lib/stats-engine'

describe('stats engine', () => {
  it('matches the worked ELO scenario example', () => {
    const result = calculateRoundEloDeltas(
      [
        { playerId: 'monica', score: 768, ratingBefore: 1485 },
        { playerId: 'brian', score: -768, ratingBefore: 1698 },
        { playerId: 'kendall', score: 0, ratingBefore: 1524 },
        { playerId: 'matt', score: 0, ratingBefore: 1551 }
      ],
      { eloBaseK: 16 }
    )

    const byPlayer = Object.fromEntries(result.map(item => [item.playerId, item]))

    expect(byPlayer.monica.delta).toBeCloseTo(77, 0)
    expect(byPlayer.monica.ratingAfter).toBe(1562)
    expect(byPlayer.brian.delta).toBeCloseTo(-88, 0)
    expect(byPlayer.brian.ratingAfter).toBe(1610)
    expect(byPlayer.kendall.delta).toBeCloseTo(7, 0)
    expect(byPlayer.kendall.ratingAfter).toBe(1531)
    expect(byPlayer.matt.delta).toBeCloseTo(3, 0)
    expect(byPlayer.matt.ratingAfter).toBe(1554)
  })

  it('assigns the correct title band for exact boundary values', () => {
    const bands: TitleBand[] = [
      { minPoints: 3000, maxPoints: 99999, title: 'Messiah' },
      { minPoints: 1800, maxPoints: 2999, title: 'Master' },
      { minPoints: 350, maxPoints: 1799, title: 'Musketeer' },
      { minPoints: 150, maxPoints: 349, title: 'Marshal' },
      { minPoints: -650, maxPoints: 149, title: 'Monk' },
      { minPoints: -700, maxPoints: -651, title: 'Mortal' },
      { minPoints: -1150, maxPoints: -701, title: 'Minion' },
      { minPoints: -1550, maxPoints: -1151, title: 'Mongrel' },
      { minPoints: -99999, maxPoints: -1551, title: 'Moron' }
    ]

    expect(assignTitle(149, bands)).toBe('Monk')
    expect(assignTitle(150, bands)).toBe('Marshal')
    expect(assignTitle(349, bands)).toBe('Marshal')
    expect(assignTitle(350, bands)).toBe('Musketeer')
    expect(assignTitle(-650, bands)).toBe('Monk')
    expect(assignTitle(-651, bands)).toBe('Mortal')
    expect(assignTitle(-701, bands)).toBe('Minion')
    expect(assignTitle(-1151, bands)).toBe('Mongrel')
    expect(assignTitle(-1551, bands)).toBe('Moron')
  })

  it('recomputes ranks with ties', () => {
    const result = computeGlobalRanks([
      { playerId: 'a', eloRating: 1700, totalPoints: 1000 },
      { playerId: 'b', eloRating: 1600, totalPoints: 900 },
      { playerId: 'c', eloRating: 1600, totalPoints: 900 },
      { playerId: 'd', eloRating: 1500, totalPoints: 800 }
    ])

    expect(result.eloRanks.a).toBe(1)
    expect(result.eloRanks.b).toBe(2)
    expect(result.eloRanks.c).toBe(2)
    expect(result.eloRanks.d).toBe(4)

    expect(result.pointsRanks.a).toBe(1)
    expect(result.pointsRanks.b).toBe(2)
    expect(result.pointsRanks.c).toBe(2)
    expect(result.pointsRanks.d).toBe(4)
  })
})
