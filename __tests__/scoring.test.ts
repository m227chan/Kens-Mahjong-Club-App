import { describe, it, expect } from 'vitest'
import {
  FAN_TO_POINTS,
  calculateCumulativeScores,
  calculateRankings,
  validateRound,
  calculateRoundFromFan
} from '../lib/scoring'

// Example data — not real players
const players = ['Alice', 'Bob', 'Charlie', 'Diana']

describe('FAN_TO_POINTS', () => {
  it('should have correct fan to points mapping', () => {
    expect(FAN_TO_POINTS[0]).toBe(1)
    expect(FAN_TO_POINTS[4]).toBe(16)
    expect(FAN_TO_POINTS[10]).toBe(128)
  })
})

describe('validateRound', () => {
  it('should validate rounds that sum to 0', () => {
    const validRound = { Alice: 128, Bob: -32, Charlie: -32, Diana: -64 }
    expect(validateRound(validRound)).toEqual({
      valid: true,
      sum: 0,
      message: 'Scores sum to 0 ✓'
    })
  })

  it('should invalidate rounds that do not sum to 0', () => {
    const invalidRound = { Alice: 128, Bob: -32, Charlie: -32, Diana: -32 }
    expect(validateRound(invalidRound)).toEqual({
      valid: false,
      sum: 32,
      message: 'Scores sum to 32 — must equal 0'
    })
  })
})

describe('calculateCumulativeScores', () => {
  it('should calculate correct running totals', () => {
    const rounds = [
      { datetime: '2024-01-01', scores: { Alice: 10, Bob: -5, Charlie: -5, Diana: 0 } },
      { datetime: '2024-01-02', scores: { Alice: 20, Bob: -10, Charlie: -10, Diana: 0 } }
    ]

    const result = calculateCumulativeScores(rounds, players)

    expect(result.Alice).toEqual([10, 30])
    expect(result.Bob).toEqual([-5, -15])
    expect(result.Charlie).toEqual([-5, -15])
    expect(result.Diana).toEqual([0, 0])
  })
})

describe('calculateRankings', () => {
  it('should sort players by score and assign ranks', () => {
    const cumulativeScores = { Alice: 100, Bob: 50, Charlie: 50, Diana: 25 }
    const roundsPlayedMap = { Alice: 5, Bob: 5, Charlie: 5, Diana: 5 }

    const rankings = calculateRankings(players, cumulativeScores, roundsPlayedMap)

    expect(rankings[0].name).toBe('Alice')
    expect(rankings[0].rank).toBe(1)
    expect(rankings[0].displayRank).toBe('1')
    expect(rankings[0].isTied).toBe(false)

    expect(rankings[1].name).toBe('Bob')
    expect(rankings[1].rank).toBe(2)
    expect(rankings[1].displayRank).toBe('2')
    expect(rankings[1].isTied).toBe(false)

    expect(rankings[2].name).toBe('Charlie')
    expect(rankings[2].rank).toBe(2)
    expect(rankings[2].displayRank).toBe('=2')
    expect(rankings[2].isTied).toBe(true)

    expect(rankings[3].name).toBe('Diana')
    expect(rankings[3].rank).toBe(4)
    expect(rankings[3].displayRank).toBe('4')
    expect(rankings[3].isTied).toBe(false)
  })
})

describe('calculateRoundFromFan', () => {
  it('should calculate self-draw correctly', () => {
    const result = calculateRoundFromFan(3, 'self-draw', 'Alice', players)

    expect(result.Alice).toBe(24) // 8 * 3
    expect(result.Bob).toBe(-8)
    expect(result.Charlie).toBe(-8)
    expect(result.Diana).toBe(-8)
  })

  it('should calculate discard win correctly', () => {
    const result = calculateRoundFromFan(4, 'discard', 'Alice', players, 'Bob')

    expect(result.Alice).toBe(32) // 16 * 2
    expect(result.Bob).toBe(-32) // 16 * 2
    expect(result.Charlie).toBe(0)
    expect(result.Diana).toBe(0)
  })
})