import { describe, it, expect } from 'vitest'
import { PLAYER_COLORS, RANK_TITLES, assignPlayerColors, assignTitles, rankTitleBandSizes, titleForStanding } from '../lib/players'

describe('PLAYER_COLORS', () => {
  it('should have 14 colors', () => {
    expect(PLAYER_COLORS).toHaveLength(14)
  })
})

describe('assignPlayerColors', () => {
  it('should assign colors by index', () => {
    const players = ['Alice', 'Bob', 'Charlie']
    const result = assignPlayerColors(players)

    expect(result.Alice).toBe(PLAYER_COLORS[0])
    expect(result.Bob).toBe(PLAYER_COLORS[1])
    expect(result.Charlie).toBe(PLAYER_COLORS[2])
  })

  it('should cycle colors for more than 14 players', () => {
    const players = Array.from({ length: 15 }, (_, i) => `Player${i + 1}`)
    const result = assignPlayerColors(players)

    expect(result.Player15).toBe(PLAYER_COLORS[0]) // Cycles back
  })

  it('should return correct map length', () => {
    const players = ['Alice', 'Bob']
    const result = assignPlayerColors(players)

    expect(Object.keys(result)).toHaveLength(2)
  })
})

describe('normal-distribution rank titles', () => {
  it('uses the requested 9-band proportions for 100 players', () => {
    expect(rankTitleBandSizes(100)).toEqual([4, 7, 12, 17, 20, 17, 12, 7, 4])
  })

  it('keeps every outer pair symmetric after rounding', () => {
    for (const total of [5, 15, 52, 99]) {
      const sizes = rankTitleBandSizes(total)
      expect(sizes.reduce((sum, size) => sum + size, 0)).toBe(total)
      expect(sizes[0]).toBe(sizes[8])
      expect(sizes[1]).toBe(sizes[7])
      expect(sizes[2]).toBe(sizes[6])
      expect(sizes[3]).toBe(sizes[5])
    }
  })

  it('assigns titles straight down the ranked list', () => {
    const expected = RANK_TITLES.flatMap((title, index) =>
      Array.from({ length: rankTitleBandSizes(100)[index] }, () => title)
    )

    expect(Array.from({ length: 100 }, (_, index) => titleForStanding(index + 1, 100))).toEqual(expected)
  })

  it('allows empty bands in small clubs without losing players', () => {
    expect(rankTitleBandSizes(5)).toEqual([0, 0, 1, 1, 1, 1, 1, 0, 0])
    expect(Array.from({ length: 5 }, (_, index) => titleForStanding(index + 1, 5))).toEqual([
      'Musketeer',
      'Marshal',
      'Monk',
      'Mortal',
      'Minion'
    ])
  })

  it('recalculates assignTitles from each current rank', () => {
    const rankedPlayers = Array.from({ length: 100 }, (_, index) => ({
      name: 'Player' + (index + 1),
      rank: index + 1,
      roundsPlayed: index % 3
    }))

    const result = assignTitles(rankedPlayers, rankedPlayers.length)

    expect(result.Player1.title).toBe('Messiah')
    expect(result.Player50.title).toBe('Monk')
    expect(result.Player100.title).toBe('Moron')
    expect(Object.keys(result)).toHaveLength(100)
  })
})