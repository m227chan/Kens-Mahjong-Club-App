import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlayerDoc, SessionDoc } from '@/lib/types'

const { playMock, subscribeActiveSessionMock, tableActionMock, updateSessionMock } = vi.hoisted(() => ({
  playMock: vi.fn(),
  subscribeActiveSessionMock: vi.fn(),
  tableActionMock: vi.fn(),
  updateSessionMock: vi.fn(),
}))

const players = [
  { id: 'jane', displayName: 'Jane', icon: '🐎', authUid: 'user-1', title: '', active: true },
  { id: 'bob', displayName: 'Bob', icon: '🏆', authUid: null, title: '', active: true },
] as PlayerDoc[]

const activeSession = {
  id: 'session-1',
  seasonNumber: 1,
  tableCount: 1,
  participants: ['jane', 'bob'],
  tables: { '1': ['jane'] },
  sideline: ['bob'],
  isActive: true,
} as unknown as SessionDoc

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1' }, loading: false, isAdmin: false }),
}))
vi.mock('@/contexts/SoundContext', () => ({
  useSound: () => ({ play: playMock }),
}))
vi.mock('@/contexts/GameSyncContext', () => ({
  useGameSync: () => ({ saveGame: vi.fn() }),
}))
vi.mock('@/lib/data', () => ({
  closeSession: vi.fn(),
  createGame: vi.fn(),
  createSession: vi.fn(),
  subscribeActiveSession: subscribeActiveSessionMock,
  subscribePlayers: vi.fn(() => () => undefined),
  updateSession: updateSessionMock,
}))
vi.mock('@/lib/table-checkin-client', () => ({
  getQrEnrollmentSetting: vi.fn(),
  setQrEnrollmentSetting: vi.fn(),
  tableAction: tableActionMock,
}))

import SessionManager from '@/components/SessionManager'

describe('session manager optimistic table changes', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    playMock.mockReset()
    tableActionMock.mockReset()
    updateSessionMock.mockReset()
    subscribeActiveSessionMock.mockReset()
  })

  it('removes a player before the database request resolves', async () => {
    subscribeActiveSessionMock.mockImplementation(
      (_clubId: string, _seasonNumber: number, onValue: (session: SessionDoc) => void) => {
        onValue(activeSession)
        return () => undefined
      },
    )
    let finishMutation: ((value: { status: 'ok'; session: typeof activeSession }) => void) | undefined
    tableActionMock.mockImplementation(() => new Promise((resolve) => { finishMutation = resolve }))

    render(
      <SessionManager
        clubId="TEST"
        seasonNumber={1}
        players={players}
      />,
    )

    await screen.findByRole('button', { name: 'Move Jane to the sideline' })
    const singleTableCollection = screen.getByRole('list', { name: 'Session tables' })
    expect(singleTableCollection.className).toBe('tables-container')
    expect(singleTableCollection.getAttribute('aria-describedby')).toBeNull()
    expect(screen.queryByText('Swipe to browse')).toBeNull()
    expect(document.querySelector('.sideline-toggle')?.getAttribute('aria-expanded')).toBe('false')
    fireEvent.click(await screen.findByRole('button', { name: 'Move Jane to the sideline' }))

    expect(screen.queryByRole('button', { name: 'Move Jane to the sideline' })).toBeNull()
    expect(document.getElementById('sidelineArea')?.textContent).toContain('Jane')
    await waitFor(() =>
      expect(tableActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'remove',
          playerId: 'jane',
          tableNumber: 1,
        }),
      ),
    )

    finishMutation?.({
      status: 'ok',
      session: {
        ...activeSession,
        tables: { '1': [] },
        sideline: ['bob', 'jane'],
      },
    })
    await waitFor(() => expect(document.getElementById('sidelineArea')?.textContent).toContain('Jane'))
  }, 10_000)

  it('keeps the signed-in player table open in a large session', async () => {
    const largeSession = {
      ...activeSession,
      tableCount: 8,
      tables: { '1': [], '2': [], '3': [], '4': ['jane'], '5': [], '6': [], '7': [], '8': [] },
    } as unknown as SessionDoc
    subscribeActiveSessionMock.mockImplementation(
      (_clubId: string, _seasonNumber: number, onValue: (session: SessionDoc) => void) => {
        onValue(largeSession)
        return () => undefined
      },
    )

    render(<SessionManager clubId="TEST" seasonNumber={1} players={players} />)

    expect(await screen.findByRole('button', { name: 'My table 4' })).not.toBeNull()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Expand Table 1' })).not.toBeNull())
    expect(screen.getByRole('button', { name: 'Collapse Table 4' })).not.toBeNull()
    const currentTableJump = screen.getByRole('button', { name: /Jump to Table 4.*your table/i })
    expect(currentTableJump.getAttribute('aria-current')).toBe('location')
    expect(currentTableJump.getAttribute('aria-pressed')).toBe('true')

    const tableCollection = screen.getByRole('list', { name: 'Session tables' })
    expect(tableCollection.className).toBe('tables-container')
    expect(screen.getAllByRole('listitem', { name: /Table \d/ })).toHaveLength(8)
    const jumpStrip = document.querySelector('.session-table-jumps')
    const tableControls = document.querySelector('.session-mobile-table-controls')
    if (!jumpStrip || !tableControls) throw new Error('Expected the mobile table navigation controls')
    expect(jumpStrip.querySelectorAll('button')).toHaveLength(8)
    expect(tableControls.getAttribute('aria-label')).toBe('Change the number of session tables')
    expect(tableControls.parentElement?.className).toBe('session-mobile-table-toolbar')
    expect(tableControls.parentElement?.parentElement).toBe(jumpStrip?.parentElement)
    expect(screen.queryByText('Swipe to browse')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'Swipe view' })).toBeNull()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tables or players' }), { target: { value: 'Jane' } })
    await waitFor(() => expect(screen.getAllByRole('listitem', { name: /Table \d/ })).toHaveLength(1))
    expect(tableCollection.className).toBe('tables-container')

    fireEvent.click(screen.getByRole('button', { name: 'Clear table search' }))
    await waitFor(() => expect(screen.getAllByRole('listitem', { name: /Table \d/ })).toHaveLength(8))
  }, 10_000)

  it('opens the roster add-player flow from the session actions menu', async () => {
    const onAddPlayer = vi.fn()
    subscribeActiveSessionMock.mockImplementation(
      (_clubId: string, _seasonNumber: number, onValue: (session: SessionDoc) => void) => {
        onValue(activeSession)
        return () => undefined
      },
    )

    render(<SessionManager clubId="TEST" seasonNumber={1} players={players} onAddPlayer={onAddPlayer} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Session actions' }))
    expect(screen.getByRole('dialog', { name: 'Session actions' }).parentElement).toBe(document.body)
    fireEvent.click(screen.getByRole('button', { name: /Add player/i }))

    expect(onAddPlayer).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog', { name: 'Session actions' })).toBeNull()
  })

  it('adds and safely removes session tables from the compact controls', async () => {
    const twoTableSession = {
      ...activeSession,
      tableCount: 2,
      tables: { '1': ['jane'], '2': ['bob'] },
      sideline: [],
    } as unknown as SessionDoc
    subscribeActiveSessionMock.mockImplementation(
      (_clubId: string, _seasonNumber: number, onValue: (session: SessionDoc) => void) => {
        onValue(twoTableSession)
        return () => undefined
      },
    )
    updateSessionMock.mockResolvedValue(undefined)

    render(<SessionManager clubId="TEST" seasonNumber={1} players={players} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add a table', hidden: true }))
    await waitFor(() => expect(updateSessionMock).toHaveBeenLastCalledWith(
      'TEST',
      'session-1',
      expect.objectContaining({ tableCount: 3, tables: expect.objectContaining({ '3': [] }) }),
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Remove the last table', hidden: true }))
    await waitFor(() => expect(updateSessionMock).toHaveBeenLastCalledWith(
      'TEST',
      'session-1',
      expect.objectContaining({ tableCount: 2 }),
    ))

    fireEvent.click(screen.getByRole('button', { name: 'Remove the last table', hidden: true }))
    await waitFor(() => expect(updateSessionMock).toHaveBeenLastCalledWith(
      'TEST',
      'session-1',
      expect.objectContaining({
        tableCount: 1,
        tables: { '1': ['jane'] },
        sideline: ['bob'],
      }),
    ))
  })

  it('restores the setup table count when a compact table change fails', async () => {
    const twoTableSession = {
      ...activeSession,
      tableCount: 2,
      tables: { '1': ['jane'], '2': ['bob'] },
      sideline: [],
    } as unknown as SessionDoc
    subscribeActiveSessionMock.mockImplementation(
      (_clubId: string, _seasonNumber: number, onValue: (session: SessionDoc) => void) => {
        onValue(twoTableSession)
        return () => undefined
      },
    )
    updateSessionMock.mockRejectedValue(new Error('Save failed'))

    render(<SessionManager clubId="TEST" seasonNumber={1} players={players} />)

    fireEvent.click(await screen.findByRole('button', { name: 'Add a table', hidden: true }))
    await screen.findByText('Save failed')
    fireEvent.click(screen.getByRole('button', { name: 'Session actions' }))
    fireEvent.click(screen.getByRole('button', { name: /Edit Session/i }))

    expect((screen.getByRole('spinbutton', { name: 'Number of tables', hidden: true }) as HTMLInputElement).value).toBe('2')
  })

  it('opens the roster add-player flow from the explicit mobile control', async () => {
    const onAddPlayer = vi.fn()
    subscribeActiveSessionMock.mockImplementation(
      (_clubId: string, _seasonNumber: number, onValue: (session: SessionDoc) => void) => {
        onValue(activeSession)
        return () => undefined
      },
    )

    render(<SessionManager clubId="TEST" seasonNumber={1} players={players} onAddPlayer={onAddPlayer} />)

    await screen.findByRole('button', { name: 'Session actions' })
    fireEvent.click(screen.getByLabelText('Add a new player', { selector: 'button' }))
    expect(onAddPlayer).toHaveBeenCalledOnce()
  })
})
