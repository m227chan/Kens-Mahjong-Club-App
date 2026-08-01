import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  OFFLINE_GAME_QUEUE_EVENT,
  enqueueGame,
  listQueuedGames,
  markQueuedGamesForRetry,
  queuedGameSyncInput,
  removeQueuedGame,
  updateQueuedGame,
  type OfflineGameInput,
} from '@/lib/offline-game-queue'

const input: OfflineGameInput = {
  entries: [
    { playerId: 'a', score: 24 },
    { playerId: 'b', score: -8 },
    { playerId: 'c', score: -8 },
    { playerId: 'd', score: -8 },
  ],
  createdBy: 'user-1',
  seasonNumber: 2,
  tableId: '1',
  winType: 'self_draw',
  loserPlayerId: null,
  fan: 5,
  notes: null,
  idempotencyKey: 'game-request-1',
}

describe('offline game queue', () => {
  beforeEach(() => window.localStorage.clear())

  it('persists games per user and deduplicates retries by idempotency key', () => {
    const listener = vi.fn()
    window.addEventListener(OFFLINE_GAME_QUEUE_EVENT, listener)
    const recordedAt = '2026-08-01T12:00:00.000Z'

    const first = enqueueGame('user-1', 'CLUB', input, recordedAt)
    const duplicate = enqueueGame('user-1', 'CLUB', input, recordedAt)
    enqueueGame('user-2', 'CLUB', { ...input, createdBy: 'user-2' }, recordedAt)

    expect(duplicate.id).toBe(first.id)
    expect(listQueuedGames('user-1')).toHaveLength(1)
    expect(listQueuedGames('user-2')).toHaveLength(1)
    expect(queuedGameSyncInput(first)).toMatchObject({
      idempotencyKey: input.idempotencyKey,
      datetime: recordedAt,
    })
    expect(listener).toHaveBeenCalledTimes(2)
    window.removeEventListener(OFFLINE_GAME_QUEUE_EVENT, listener)
  })

  it('retains failed games for attention and supports retry and removal', () => {
    const queued = enqueueGame('user-1', 'CLUB', input)
    updateQueuedGame(queued.id, {
      attempts: 1,
      status: 'attention',
      lastError: 'Season unavailable',
    })

    expect(listQueuedGames('user-1')[0]).toMatchObject({
      attempts: 1,
      status: 'attention',
      lastError: 'Season unavailable',
    })

    markQueuedGamesForRetry('user-1')
    expect(listQueuedGames('user-1')[0].status).toBe('pending')

    removeQueuedGame(queued.id)
    expect(listQueuedGames('user-1')).toEqual([])
  })
})
