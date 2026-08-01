import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listQueuedGames, type OfflineGameInput } from '@/lib/offline-game-queue'

const { createGameMock } = vi.hoisted(() => ({ createGameMock: vi.fn() }))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1' }, loading: false }),
}))
vi.mock('@/lib/data', () => ({ createGame: createGameMock }))

import { GameSyncProvider, useGameSync } from '@/contexts/GameSyncContext'

const game: OfflineGameInput = {
  entries: [
    { playerId: 'a', score: 24 },
    { playerId: 'b', score: -8 },
    { playerId: 'c', score: -8 },
    { playerId: 'd', score: -8 },
  ],
  createdBy: 'user-1',
  seasonNumber: 1,
  tableId: '1',
  winType: 'self_draw',
  loserPlayerId: null,
  fan: 5,
  notes: null,
  idempotencyKey: 'offline-game-1',
}

function Harness() {
  const { saveGame } = useGameSync()
  return (
    <button
      type="button"
      onClick={async () => {
        const result = await saveGame('CLUB', game)
        document.body.dataset.saveStatus = result.status
      }}
    >
      Save game
    </button>
  )
}

describe('GameSyncProvider', () => {
  beforeEach(() => {
    window.localStorage.clear()
    document.body.removeAttribute('data-save-status')
    createGameMock.mockReset().mockResolvedValue('game-1')
  })

  afterEach(() => {
    cleanup()
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
  })

  it('stores an offline game, warns the user, and syncs it on reconnect', async () => {
    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false })
    render(
      <GameSyncProvider>
        <Harness />
      </GameSyncProvider>,
    )

    fireEvent.click(screen.getByRole('button', { name: 'Save game' }))

    await waitFor(() => expect(document.body.dataset.saveStatus).toBe('queued'))
    expect(createGameMock).not.toHaveBeenCalled()
    expect(listQueuedGames('user-1')).toHaveLength(1)
    expect(screen.getByRole('status').textContent).toContain('safely stored on this device')

    Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: true })
    fireEvent(window, new Event('online'))

    await waitFor(() => expect(createGameMock).toHaveBeenCalledWith(
      'CLUB',
      expect.objectContaining({
        idempotencyKey: 'offline-game-1',
        datetime: expect.any(String),
      }),
    ))
    await waitFor(() => expect(listQueuedGames('user-1')).toEqual([]))
    expect(await screen.findByText('1 saved game synced.')).toBeTruthy()
  })
})
