import { describe, it, expect, beforeEach } from 'vitest'
import { getSheetData, appendGameRound, getPlayerCount } from '../lib/sheets'

// EXAMPLE_SHEET_ID_FOR_TESTING
const EXAMPLE_SHEET_ID = '1abc123def456'

describe('getSheetData', () => {
  it('should return valid AppData structure', async () => {
    const data = await getSheetData()

    expect(data).toHaveProperty('players')
    expect(data).toHaveProperty('rounds')
    expect(data).toHaveProperty('isOffline')
    expect(data).toHaveProperty('lastUpdated')
    expect(Array.isArray(data.players)).toBe(true)
    expect(Array.isArray(data.rounds)).toBe(true)
  })

  it('should parse player names from header dynamically', async () => {
    const data = await getSheetData()

    expect(data.players.length).toBeGreaterThan(0)
    data.players.forEach(player => {
      expect(typeof player).toBe('string')
    })
  })
})

describe('appendGameRound', () => {
  it('should write scores in correct column order', async () => {
    const round: any = {
      datetime: '2024-01-02T10:00:00.000Z',
      scores: { Alice: 16, Bob: -4, Charlie: -4, Diana: -8 }
    }
    const players = ['Alice', 'Bob', 'Charlie', 'Diana']

    await appendGameRound(round, players)

    const data = await getSheetData()
    const lastRound = data.rounds[data.rounds.length - 1]

    expect(lastRound.datetime).toBe(round.datetime)
    expect(lastRound.scores).toEqual(round.scores)
  })
})

describe('getPlayerCount', () => {
  it('should return number of player columns', () => {
    const count = getPlayerCount()
    expect(typeof count).toBe('number')
    expect(count).toBeGreaterThan(0)
  })
})