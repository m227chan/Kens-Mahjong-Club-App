import { describe, expect, it } from 'vitest'
import { Timestamp } from '../lib/timestamp'
import { DEFAULT_GAME_LOG_AUDIENCE, DEFAULT_GAME_LOG_LAYOUT, filterGamesByAudience } from '../lib/game-log-view'
import type { GameDoc } from '../lib/types'

const game = (id: string, playerIds: string[]): GameDoc => ({
  id,
  datetime: Timestamp.fromDate(new Date('2026-01-01T00:00:00Z')),
  createdBy: 'test-user',
  seasonNumber: 1,
  tableId: null,
  entries: playerIds.map((playerId) => ({ playerId, score: 0 })),
  winType: 'draw',
  winnerPlayerId: null,
  loserPlayerId: null,
  fan: null,
  notes: null
})

describe('game log view defaults', () => {
  const games = [game('session-game', ['a', 'b', 'c', 'd']), game('other-game', ['e', 'f', 'g', 'h'])]

  it('defaults to session-player games in the card layout', () => {
    expect(DEFAULT_GAME_LOG_AUDIENCE).toBe('session')
    expect(DEFAULT_GAME_LOG_LAYOUT).toBe('cards')
    expect(filterGamesByAudience(games, DEFAULT_GAME_LOG_AUDIENCE, ['a', 'b'], '')).toEqual([games[0]])
  })

  it('supports all games and an individually selected player', () => {
    expect(filterGamesByAudience(games, 'all', ['a'], '')).toEqual(games)
    expect(filterGamesByAudience(games, 'player', [], 'f')).toEqual([games[1]])
  })
})
