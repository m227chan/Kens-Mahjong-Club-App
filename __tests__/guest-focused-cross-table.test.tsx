import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { playMock, tableActionMock } = vi.hoisted(() => ({
  playMock: vi.fn(),
  tableActionMock: vi.fn(),
}))

const players = [
  { id: 'jane', displayName: 'Jane', icon: '🐎', authUid: null },
  { id: 'bob', displayName: 'Bob', icon: '🏆', authUid: null },
  { id: 'jeff', displayName: 'Jeff', icon: '🎲', authUid: null },
  { id: 'matt', displayName: 'Matt', icon: '🌙', authUid: null },
]

const session = {
  id: 'session-1',
  seasonNumber: 1,
  tableCount: 2,
  participants: players.map((player) => player.id),
  tables: { '1': [] as string[] },
  sideline: ['bob'] as string[],
  tableWinds: {},
  revision: 1,
}

const guestContext = {
  clubId: 'GEUX7Z',
  clubName: 'CalvinTest',
  seasonNumber: 1,
  tableNumber: 1,
  session,
  players,
  linkedPlayer: null,
  guest: true,
  windRotation: { mode: 'non_dealer_and_draw' as const },
}

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: null,
    loading: false,
    signingIn: false,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
  }),
}))
vi.mock('@/contexts/SoundContext', () => ({
  useSound: () => ({ play: playMock }),
}))
vi.mock('@/contexts/GameSyncContext', () => ({
  useGameSync: () => ({ saveGame: vi.fn() }),
}))
vi.mock('@/lib/data', () => ({
  requestToJoinClub: vi.fn(),
  subscribeActiveSession: vi.fn(() => () => undefined),
  subscribePlayers: vi.fn(() => () => undefined),
  subscribePlayerStats: vi.fn(() => () => undefined),
  subscribeScoringRules: vi.fn(() => () => undefined),
  loadAllGames: vi.fn().mockResolvedValue([]),
}))
vi.mock('@/lib/guest-table-session', () => ({
  clearGuestTableSession: vi.fn(),
  exitGuestTableToLogin: vi.fn(),
  guestSessionMatches: vi.fn(() => true),
}))
vi.mock('@/lib/table-checkin-client', () => ({
  tableAction: tableActionMock,
  generateTableQr: vi.fn(),
  createGuestGame: vi.fn(),
}))

import FocusedTableView from '@/components/FocusedTableView'
import { GUEST_CROSS_TABLE_SEAT_MESSAGE } from '@/lib/guest-table-messages'

describe('guest focused table cross-table seat', () => {
  beforeEach(() => {
    window.localStorage.setItem('focused-table-layout', 'basic')
    tableActionMock.mockImplementation((body: { action: string }) => {
      if (body.action === 'context') return Promise.resolve(guestContext)
      return Promise.resolve({ status: 'ok', session })
    })
  })

  afterEach(() => {
    cleanup()
    playMock.mockClear()
    tableActionMock.mockReset()
    window.localStorage.clear()
  })

  it('opens a login-required popup when seating a player from another table', async () => {
    render(<FocusedTableView clubId="GEUX7Z" tableNumber={1} />)

    const addButtons = await screen.findAllByRole('button', { name: /Add player/i })
    fireEvent.click(addButtons[0])
    fireEvent.click(await screen.findByRole('button', { name: /Jane/i }))

    expect(
      await screen.findByRole('dialog', { name: /sign in to move that player/i }),
    ).toBeTruthy()
    expect(screen.getByText(GUEST_CROSS_TABLE_SEAT_MESSAGE)).toBeTruthy()
    expect(tableActionMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ action: 'seat', playerId: 'jane' }),
    )
  })

  it('opens the login popup when the server rejects a cross-table seat', async () => {
    tableActionMock.mockImplementation((body: { action: string }) => {
      if (body.action === 'context') return Promise.resolve(guestContext)
      if (body.action === 'seat') {
        return Promise.reject(new Error(GUEST_CROSS_TABLE_SEAT_MESSAGE))
      }
      return Promise.resolve({ status: 'ok', session })
    })

    render(<FocusedTableView clubId="GEUX7Z" tableNumber={1} />)
    const addButtons = await screen.findAllByRole('button', { name: /Add player/i })
    fireEvent.click(addButtons[0])
    fireEvent.click(await screen.findByRole('button', { name: /Bob/i }))

    await waitFor(() =>
      expect(
        screen.getByRole('dialog', { name: /sign in to move that player/i }),
      ).toBeTruthy(),
    )
  })
})
