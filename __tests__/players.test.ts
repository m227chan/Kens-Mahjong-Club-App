import { describe, it, expect } from 'vitest'
import { PLAYER_COLORS, assignPlayerColors, assignTitles } from '../lib/players'

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

describe('assignTitles', () => {
  it('should assign Messiah, Master, Mongrel, Moron for N=4', () => {
    const rankedPlayers = [
      { name: 'Alice', rank: 1, roundsPlayed: 5 },
      { name: 'Bob', rank: 2, roundsPlayed: 5 },
      { name: 'Charlie', rank: 3, roundsPlayed: 5 },
      { name: 'Diana', rank: 4, roundsPlayed: 5 }
    ]

    const result = assignTitles(rankedPlayers, 4)

    expect(result.Alice).toEqual({ title: 'Messiah', emoji: '👑' })
    expect(result.Bob).toEqual({ title: 'Master', emoji: '🏆' })
    expect(result.Charlie).toEqual({ title: 'Mongrel', emoji: '🐶' })
    expect(result.Diana).toEqual({ title: 'Moron', emoji: '🤡' })
  })

  it('should assign Messiah, Master, Monk, Mongrel, Moron for N=5', () => {
    const rankedPlayers = [
      { name: 'Alice', rank: 1, roundsPlayed: 5 },
      { name: 'Bob', rank: 2, roundsPlayed: 5 },
      { name: 'Charlie', rank: 3, roundsPlayed: 5 },
      { name: 'Diana', rank: 4, roundsPlayed: 5 },
      { name: 'Eve', rank: 5, roundsPlayed: 5 }
    ]

    const result = assignTitles(rankedPlayers, 5)

    expect(result.Alice).toEqual({ title: 'Messiah', emoji: '👑' })
    expect(result.Bob).toEqual({ title: 'Master', emoji: '🏆' })
    expect(result.Charlie).toEqual({ title: 'Monk', emoji: '🧘' })
    expect(result.Diana).toEqual({ title: 'Mongrel', emoji: '🐶' })
    expect(result.Eve).toEqual({ title: 'Moron', emoji: '🤡' })
  })

  it('should assign Messiah, Master, Monk, Minion, Mongrel, Moron for N=6', () => {
    const rankedPlayers = [
      { name: 'Alice', rank: 1, roundsPlayed: 5 },
      { name: 'Bob', rank: 2, roundsPlayed: 5 },
      { name: 'Charlie', rank: 3, roundsPlayed: 5 },
      { name: 'Diana', rank: 4, roundsPlayed: 5 },
      { name: 'Eve', rank: 5, roundsPlayed: 5 },
      { name: 'Frank', rank: 6, roundsPlayed: 5 }
    ]

    const result = assignTitles(rankedPlayers, 6)

    expect(result.Alice).toEqual({ title: 'Messiah', emoji: '👑' })
    expect(result.Bob).toEqual({ title: 'Master', emoji: '🏆' })
    expect(result.Charlie).toEqual({ title: 'Monk', emoji: '🧘' })
    expect(result.Diana).toEqual({ title: 'Minion', emoji: '🪄' })
    expect(result.Eve).toEqual({ title: 'Mongrel', emoji: '🐶' })
    expect(result.Frank).toEqual({ title: 'Moron', emoji: '🤡' })
  })

  it('should assign all middle ranks as Monk for N=10', () => {
    const rankedPlayers = Array.from({ length: 10 }, (_, i) => ({
      name: `Player${i + 1}`,
      rank: i + 1,
      roundsPlayed: 5
    }))

    const result = assignTitles(rankedPlayers, 10)

    expect(result.Player1).toEqual({ title: 'Messiah', emoji: '👑' })
    expect(result.Player2).toEqual({ title: 'Master', emoji: '🏆' })
    expect(result.Player3).toEqual({ title: 'Monk', emoji: '🧘' })
    expect(result.Player4).toEqual({ title: 'Monk', emoji: '🧘' })
    expect(result.Player5).toEqual({ title: 'Monk', emoji: '🧘' })
    expect(result.Player6).toEqual({ title: 'Monk', emoji: '🧘' })
    expect(result.Player7).toEqual({ title: 'Monk', emoji: '🧘' })
    expect(result.Player8).toEqual({ title: 'Minion', emoji: '🪄' }) // N-2 = 8
    expect(result.Player9).toEqual({ title: 'Mongrel', emoji: '🐶' })
    expect(result.Player10).toEqual({ title: 'Moron', emoji: '🤡' })
  })

  it('should assign Moron to both players in a tie at last rank', () => {
    const rankedPlayers = [
      { name: 'Alice', rank: 1, roundsPlayed: 5 },
      { name: 'Bob', rank: 2, roundsPlayed: 5 },
      { name: 'Charlie', rank: 2, roundsPlayed: 5 }, // Tied for 2nd
      { name: 'Diana', rank: 4, roundsPlayed: 5 }
    ]

    const result = assignTitles(rankedPlayers, 4)

    expect(result.Alice).toEqual({ title: 'Messiah', emoji: '👑' })
    expect(result.Bob).toEqual({ title: 'Master', emoji: '🏆' })
    expect(result.Charlie).toEqual({ title: 'Master', emoji: '🏆' }) // Tied, shares higher title
    expect(result.Diana).toEqual({ title: 'Moron', emoji: '🤡' })
  })

  it('should assign Monk to new players regardless of rank', () => {
    const rankedPlayers = [
      { name: 'Alice', rank: 1, roundsPlayed: 0 }, // New player at rank 1
      { name: 'Bob', rank: 2, roundsPlayed: 5 }
    ]

    const result = assignTitles(rankedPlayers, 4)

    expect(result.Alice).toEqual({ title: 'Monk', emoji: '🧘' }) // New player
    expect(result.Bob).toEqual({ title: 'Master', emoji: '🏆' })
  })
})