import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { createGameMock, playMock, tableActionMock } = vi.hoisted(() => ({
  createGameMock: vi.fn().mockResolvedValue({ status: 'synced' }),
  playMock: vi.fn(),
  tableActionMock: vi.fn(),
}))

const players = [
  { id: 'jane', displayName: 'Jane', icon: '🐎', authUid: 'user-1' },
  { id: 'bob', displayName: 'Bob', icon: '🏆', authUid: null },
  { id: 'jeff', displayName: 'Jeff', icon: '🎲', authUid: null },
  { id: 'matt', displayName: 'Matt', icon: '🌙', authUid: null },
]

const session = {
  id: 'session-1',
  seasonNumber: 1,
  tableCount: 1,
  participants: players.map((player) => player.id),
  tables: { '1': players.map((player) => player.id) },
  sideline: [] as string[],
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
}

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1' }, loading: false }),
}))
vi.mock('@/contexts/SoundContext', () => ({
  useSound: () => ({ play: playMock }),
}))
vi.mock('@/contexts/GameSyncContext', () => ({
  useGameSync: () => ({ saveGame: createGameMock }),
}))
vi.mock('@/lib/data', () => ({
  subscribeActiveSession: vi.fn(() => () => undefined),
  subscribePlayers: vi.fn(() => () => undefined),
  subscribeScoringRules: vi.fn(() => () => undefined),
}))
vi.mock('@/lib/table-checkin-client', () => ({
  tableAction: tableActionMock,
  generateTableQr: vi.fn(),
}))

import FocusedTableView from '@/components/FocusedTableView'

describe('focused table scoring', () => {
  beforeEach(() => {
    tableActionMock.mockImplementation((body: { action: string }) => Promise.resolve(
      body.action === 'context' ? context : { status: 'ok', session },
    ))
  })

  afterEach(() => {
    cleanup()
    createGameMock.mockClear()
    playMock.mockClear()
    tableActionMock.mockReset()
  })

  it('keeps the save action outside the scrolling result form and celebrates a win', async () => {
    render(<FocusedTableView clubId="TEST" tableNumber={1} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Winner…' }))
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

    fireEvent.click(await screen.findByRole('button', { name: 'Draw (0 pts)' }))

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
})
