import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createGameMock, playMock, tableActionMock, loadAllGamesMock, subscribePlayerStatsMock } = vi.hoisted(() => ({
  createGameMock: vi.fn().mockResolvedValue({ status: 'synced' }),
  playMock: vi.fn(),
  tableActionMock: vi.fn(),
  loadAllGamesMock: vi.fn().mockResolvedValue([]),
  subscribePlayerStatsMock: vi.fn(() => () => undefined),
}))

const players = [
  { id: 'jane', displayName: 'Jane', icon: '🐎', authUid: 'user-1' },
  { id: 'bob', displayName: 'Bob', icon: '🏆', authUid: null },
  { id: 'jeff', displayName: 'Jeff', icon: '🎲', authUid: null },
  { id: 'matt', displayName: 'Matt', icon: '🌙', authUid: null },
]

const windState = {
  roundWind: 'east' as const,
  dealerPlayerId: 'jane',
  roundStarterPlayerId: 'jane',
  handNumber: 1,
  seatOrder: players.map((player) => player.id),
}

const session = {
  id: 'session-1',
  seasonNumber: 1,
  tableCount: 1,
  participants: players.map((player) => player.id),
  tables: { '1': players.map((player) => player.id) },
  sideline: [] as string[],
  tableWinds: { '1': windState },
  revision: 1,
}

const context = {
  clubId: 'TEST',
  clubName: 'Test Club',
  seasonNumber: 1,
  tableNumber: 1,
  session,
  players,
  linkedPlayer: players[0],
  windRotation: { mode: 'non_dealer_and_draw' as const },
}

const routerMock = { replace: vi.fn() }

vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
const authUser = { uid: 'user-1' }

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: authUser,
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
  useGameSync: () => ({ saveGame: createGameMock }),
}))
vi.mock('@/lib/data', () => ({
  requestToJoinClub: vi.fn(),
  subscribeActiveSession: vi.fn(() => () => undefined),
  subscribePlayers: vi.fn(() => () => undefined),
  subscribePlayerStats: subscribePlayerStatsMock,
  subscribeScoringRules: vi.fn(() => () => undefined),
  loadAllGames: loadAllGamesMock,
}))
vi.mock('@/lib/guest-table-session', () => ({
  clearGuestTableSession: vi.fn(),
  exitGuestTableToLogin: vi.fn(),
  guestSessionMatches: vi.fn(() => false),
}))
vi.mock('@/lib/table-checkin-client', () => ({
  tableAction: tableActionMock,
  generateTableQr: vi.fn(),
  createGuestGame: vi.fn(),
}))

import FocusedTableView from '@/components/FocusedTableView'

describe('focused table scoring', () => {
  beforeEach(() => {
    window.localStorage.setItem('focused-table-layout', 'basic')
    tableActionMock.mockImplementation((body: { action: string }) => {
      if (body.action === 'context') return Promise.resolve(context)
      if (body.action === 'advanceTableWinds') {
        return Promise.resolve({
          status: 'ok',
          session: {
            ...session,
            tableWinds: {
              '1': {
                ...windState,
                dealerPlayerId: 'bob',
                handNumber: 2,
              },
            },
          },
          rotated: true,
        })
      }
      return Promise.resolve({ status: 'ok', session })
    })
  })

  afterEach(() => {
    cleanup()
    createGameMock.mockClear()
    playMock.mockClear()
    tableActionMock.mockReset()
    loadAllGamesMock.mockClear()
    subscribePlayerStatsMock.mockClear()
    subscribePlayerStatsMock.mockImplementation(() => () => undefined)
    window.localStorage.clear()
  })

  it('keeps the save action outside the scrolling result form and celebrates a win', async () => {
    render(<FocusedTableView clubId="TEST" tableNumber={1} />)

    fireEvent.click(await screen.findByRole('button', { name: '+ Record win' }))
    const dialog = screen.getByRole('dialog', { name: 'Record winner' })
    const scrollRegion = dialog.querySelector('.focused-result-scroll')
    const actions = dialog.querySelector('.focused-result-actions')

    expect(dialog.className).toContain('overflow-hidden')
    expect(scrollRegion?.className).toContain('overflow-y-auto')
    expect(actions?.parentElement).toBe(dialog)
    expect(scrollRegion?.contains(actions)).toBe(false)

    fireEvent.click(within(dialog).getByRole('button', { name: '🐎 Jane' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Self-draw' }))
    fireEvent.click(within(dialog).getByRole('button', { name: 'Save result' }))

    await waitFor(() => expect(createGameMock).toHaveBeenCalledOnce())
    expect(await screen.findByText('Jane wins!')).toBeTruthy()
    expect(playMock).toHaveBeenCalledWith('win')
  })

  it('uses the same celebration when focused mode records a draw', async () => {
    render(<FocusedTableView clubId="TEST" tableNumber={1} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Draw' }))

    await waitFor(() => expect(createGameMock).toHaveBeenCalledOnce())
    expect(await screen.findByText('🤝 Draw recorded')).toBeTruthy()
    expect(playMock).toHaveBeenCalledWith('draw')
  })

  it('removes a player immediately while the database write is still pending', async () => {
    let finishMutation: ((value: { status: 'ok'; session: typeof session }) => void) | undefined
    tableActionMock.mockImplementation((body: { action: string }) => {
      if (body.action === 'context') return Promise.resolve(context)
      return new Promise((resolve) => { finishMutation = resolve })
    })
    render(<FocusedTableView clubId="TEST" tableNumber={1} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Remove Jane' }))

    expect(screen.queryByRole('button', { name: 'Remove Jane' })).toBeNull()
    expect(screen.getAllByRole('button', { name: /Add player/ })).toHaveLength(1)

    finishMutation?.({
      status: 'ok',
      session: {
        ...session,
        tables: { '1': ['bob', 'jeff', 'matt'] },
        sideline: ['jane'],
        revision: 2,
      },
    })
    await waitFor(() => expect(tableActionMock).toHaveBeenCalledWith(expect.objectContaining({ action: 'remove', playerId: 'jane' })))
  })

  it('lets players continue the same hand after seating a replacement', async () => {
    window.localStorage.setItem('focused-table-layout', 'wind')
    const shortSession = {
      ...session,
      tables: { '1': ['bob', 'jeff', 'matt'] },
      sideline: ['jane'],
      tableWinds: {
        '1': {
          ...windState,
          roundWind: 'south' as const,
          handNumber: 3,
        },
      },
      revision: 2,
    }
    const continuedSession = {
      ...session,
      tables: { '1': ['amy', 'bob', 'jeff', 'matt'] },
      sideline: ['jane'],
      tableWinds: {
        '1': {
          roundWind: 'south' as const,
          dealerPlayerId: 'amy',
          roundStarterPlayerId: 'amy',
          handNumber: 3,
          seatOrder: ['amy', 'bob', 'jeff', 'matt'],
        },
      },
      revision: 3,
    }
    const playersWithAmy = [
      ...players,
      { id: 'amy', displayName: 'Amy', icon: '🌸', authUid: null },
    ]
    tableActionMock.mockImplementation((body: { action: string; playerId?: string }) => {
      if (body.action === 'context') {
        return Promise.resolve({
          ...context,
          players: playersWithAmy,
          session: shortSession,
        })
      }
      if (body.action === 'seat' && body.playerId === 'amy') {
        return Promise.resolve({ status: 'ok', session: continuedSession })
      }
      return Promise.resolve({ status: 'ok', session: shortSession })
    })

    render(<FocusedTableView clubId="TEST" tableNumber={1} />)

    fireEvent.click(await screen.findByRole('button', { name: /Add player/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Amy/i }))

    expect(
      await screen.findByRole('dialog', { name: 'New player added' }),
    ).toBeTruthy()
    expect(screen.getByText(/South round · Hand 3/i)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Continue this hand' }))
    expect(screen.queryByRole('dialog', { name: 'New player added' })).toBeNull()
    expect(
      screen.getByRole('button', { name: /Table wind South\. Adjust winds/i }),
    ).toBeTruthy()
  })

  it('lets players manually change the table wind from the wind layout', async () => {
    window.localStorage.setItem('focused-table-layout', 'wind')
    tableActionMock.mockImplementation((body: { action: string; patch?: { roundWind?: string } }) => {
      if (body.action === 'context') return Promise.resolve(context)
      if (body.action === 'setTableWinds' && body.patch?.roundWind === 'south') {
        return Promise.resolve({
          status: 'ok',
          session: {
            ...session,
            tableWinds: {
              '1': { ...windState, roundWind: 'south' },
            },
            revision: 2,
          },
        })
      }
      return Promise.resolve({ status: 'ok', session })
    })

    render(<FocusedTableView clubId="TEST" tableNumber={1} />)

    fireEvent.click(
      await screen.findByRole('button', { name: /Table wind East\. Adjust winds/i }),
    )
    const dialog = screen.getByRole('dialog', { name: 'Adjust table winds' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'South' }))

    await waitFor(() =>
      expect(tableActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'setTableWinds',
          patch: { roundWind: 'south' },
        }),
      ),
    )
    expect(await screen.findByRole('button', { name: /Table wind South\. Adjust winds/i })).toBeTruthy()
  })

  it('keeps all four wind seats visible when the dealer was moved off the table', async () => {
    window.localStorage.setItem('focused-table-layout', 'wind')
    const driftedSession = {
      ...session,
      tables: { '1': ['bob', 'jeff', 'matt', 'amy'] },
      tableWinds: {
        '1': {
          ...windState,
          dealerPlayerId: 'jane',
          seatOrder: ['jane', 'bob', 'jeff', 'matt'],
        },
      },
    }
    const healedSession = {
      ...driftedSession,
      tableWinds: {
        '1': {
          roundWind: 'east' as const,
          dealerPlayerId: 'amy',
          roundStarterPlayerId: 'amy',
          handNumber: 1,
          seatOrder: ['bob', 'jeff', 'matt', 'amy'],
        },
      },
      revision: 2,
    }
    const playersWithAmy = [
      ...players,
      { id: 'amy', displayName: 'Amy', icon: '🌸', authUid: null },
    ]
    tableActionMock.mockImplementation((body: { action: string; reconcile?: boolean }) => {
      if (body.action === 'context') {
        return Promise.resolve({
          ...context,
          players: playersWithAmy,
          session: driftedSession,
        })
      }
      if (body.action === 'setTableWinds' && body.reconcile) {
        return Promise.resolve({ status: 'ok', session: healedSession })
      }
      return Promise.resolve({ status: 'ok', session: driftedSession })
    })

    render(<FocusedTableView clubId="TEST" tableNumber={1} />)

    expect(await screen.findByRole('button', { name: /Seat 1 Bob/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Seat 2 Jeff/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Seat 3 Matt/i })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Seat 4 Amy/i })).toBeTruthy()
    await waitFor(() =>
      expect(tableActionMock).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'setTableWinds', reconcile: true }),
      ),
    )
  })
})
