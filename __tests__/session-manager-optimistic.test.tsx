import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlayerDoc, SessionDoc } from '@/lib/types'

const {
  authUser,
  getQrEnrollmentSettingMock,
  playMock,
  setQrEnrollmentSettingMock,
  subscribeActiveSessionMock,
  tableActionMock,
  updateSessionMock,
} = vi.hoisted(() => ({
  authUser: { uid: 'user-1' },
  getQrEnrollmentSettingMock: vi.fn(),
  playMock: vi.fn(),
  setQrEnrollmentSettingMock: vi.fn(),
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
  useAuth: () => ({ user: authUser, loading: false, isAdmin: false }),
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
  getQrEnrollmentSetting: getQrEnrollmentSettingMock,
  setQrEnrollmentSetting: setQrEnrollmentSettingMock,
  tableAction: tableActionMock,
}))

import SessionManager from '@/components/SessionManager'

describe('session manager optimistic table changes', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    playMock.mockReset()
    getQrEnrollmentSettingMock.mockReset()
    setQrEnrollmentSettingMock.mockReset()
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
    const menu = screen.getByRole('menu', { name: 'Session actions' })
    expect(menu.closest('.session-actions-layer')?.parentElement).toBe(document.body)
    fireEvent.click(screen.getByRole('menuitem', { name: /Add player/i }))

    expect(onAddPlayer).toHaveBeenCalledOnce()
    expect(screen.queryByRole('menu', { name: 'Session actions' })).toBeNull()
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
    fireEvent.click(screen.getByRole('menuitem', { name: /Edit Session/i }))

    expect((screen.getByRole('spinbutton', { name: 'Number of tables', hidden: true }) as HTMLInputElement).value).toBe('2')
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('heading', { name: /Number of Tables/i })))
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

  it('supports keyboard navigation and restores focus when dismissed', async () => {
    subscribeActiveSessionMock.mockImplementation(
      (_clubId: string, _seasonNumber: number, onValue: (session: SessionDoc) => void) => {
        onValue(activeSession)
        return () => undefined
      },
    )

    const { container } = render(<SessionManager clubId="TEST" seasonNumber={1} players={players} onAddPlayer={vi.fn()} />)
    const trigger = await screen.findByRole('button', { name: 'Session actions' })

    fireEvent.keyDown(trigger, { key: 'ArrowDown' })
    const menu = screen.getByRole('menu', { name: 'Session actions' })
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Edit Session/i })))

    fireEvent.keyDown(menu, { key: 'ArrowDown' })
    expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Add Player/i }))
    fireEvent.keyDown(document, { key: 'Escape' })

    expect(screen.queryByRole('menu', { name: 'Session actions' })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))

    fireEvent.click(trigger)
    const layer = document.querySelector('.session-actions-layer')!
    fireEvent.pointerDown(layer)
    expect(screen.queryByRole('menu', { name: 'Session actions' })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))

    fireEvent.click(trigger)
    const tabMenu = screen.getByRole('menu', { name: 'Session actions' })
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Edit Session/i })))
    const afterMenu = document.createElement('button')
    afterMenu.textContent = 'After Session actions'
    container.append(afterMenu)
    vi.spyOn(trigger, 'getClientRects').mockReturnValue([{} as DOMRect] as unknown as DOMRectList)
    vi.spyOn(afterMenu, 'getClientRects').mockReturnValue([{} as DOMRect] as unknown as DOMRectList)
    fireEvent.keyDown(tabMenu, { key: 'Tab' })
    expect(screen.queryByRole('menu', { name: 'Session actions' })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(afterMenu))
  })

  it('opens above a low desktop trigger and clamps the menu to the viewport', async () => {
    subscribeActiveSessionMock.mockImplementation(
      (_clubId: string, _seasonNumber: number, onValue: (session: SessionDoc) => void) => {
        onValue(activeSession)
        return () => undefined
      },
    )
    vi.stubGlobal('matchMedia', vi.fn(() => ({
      matches: false,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    vi.stubGlobal('innerHeight', 800)
    vi.stubGlobal('innerWidth', 1024)

    render(<SessionManager clubId="TEST" seasonNumber={1} players={players} />)
    const trigger = await screen.findByRole('button', { name: 'Session actions' })
    vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue({
      top: 740,
      bottom: 776,
      left: 360,
      right: 400,
      width: 40,
      height: 36,
      x: 360,
      y: 740,
      toJSON: () => ({}),
    })

    fireEvent.click(trigger)
    const surface = document.getElementById('headerMenuSurface') as HTMLElement
    expect(surface.style.top).toBe('auto')
    expect(surface.style.bottom).toBe('68px')
    expect(surface.style.maxHeight).toBe('720px')
  })

  it('uses modal action-sheet semantics with a reachable Close control on mobile', async () => {
    subscribeActiveSessionMock.mockImplementation(
      (_clubId: string, _seasonNumber: number, onValue: (session: SessionDoc) => void) => {
        onValue(activeSession)
        return () => undefined
      },
    )
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(max-width: 767px)',
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))

    const { container } = render(<SessionManager clubId="TEST" seasonNumber={1} players={players} />)
    const trigger = await screen.findByRole('button', { name: 'Session actions' })
    await waitFor(() => expect(trigger.getAttribute('aria-haspopup')).toBe('dialog'))
    fireEvent.click(trigger)

    const sheet = screen.getByRole('dialog', { name: 'Session Actions' })
    const close = screen.getByRole('button', { name: 'Close session actions' })
    const edit = screen.getByRole('button', { name: /Edit Session/i })
    expect(sheet).toBeTruthy()
    expect(screen.queryByRole('menu')).toBeNull()
    await waitFor(() => {
      expect(document.activeElement).toBe(edit)
      expect(container.hasAttribute('inert')).toBe(true)
    })

    const reset = screen.getByRole('button', { name: /Reset Session/i })
    reset.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
    fireEvent.click(close)
    expect(screen.queryByRole('dialog', { name: 'Session Actions' })).toBeNull()
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger)
      expect(container.hasAttribute('inert')).toBe(false)
    })
  })

  it('keeps the QR enrollment item focused while its setting saves', async () => {
    subscribeActiveSessionMock.mockImplementation(
      (_clubId: string, _seasonNumber: number, onValue: (session: SessionDoc) => void) => {
        onValue(activeSession)
        return () => undefined
      },
    )
    getQrEnrollmentSettingMock.mockResolvedValue({ autoEnroll: false })
    let finishSave: ((setting: { autoEnroll: boolean }) => void) | undefined
    const savePromise = new Promise<{ autoEnroll: boolean }>((resolve) => { finishSave = resolve })
    setQrEnrollmentSettingMock.mockReturnValue(savePromise)

    render(<SessionManager clubId="TEST" seasonNumber={1} players={players} isManager />)
    const trigger = await screen.findByRole('button', { name: 'Session actions' })
    fireEvent.click(trigger)
    const toggle = await screen.findByRole('menuitemcheckbox', { name: /Automatic QR Enrollment/i })
    await waitFor(() => expect(toggle.getAttribute('aria-disabled')).toBe('false'))
    await waitFor(() => expect(document.activeElement).toBe(screen.getByRole('menuitem', { name: /Edit Session/i })))
    toggle.focus()
    fireEvent.click(toggle)

    await waitFor(() => expect(toggle.getAttribute('aria-disabled')).toBe('true'))
    expect(document.activeElement).toBe(toggle)

    await act(async () => {
      finishSave?.({ autoEnroll: true })
      await savePromise
    })
    await waitFor(() => {
      expect(toggle.getAttribute('aria-checked')).toBe('true')
      expect(toggle.getAttribute('aria-disabled')).toBe('false')
    })
  })

  it('returns focus to Session actions when reset is cancelled', async () => {
    subscribeActiveSessionMock.mockImplementation(
      (_clubId: string, _seasonNumber: number, onValue: (session: SessionDoc) => void) => {
        onValue(activeSession)
        return () => undefined
      },
    )
    vi.spyOn(window, 'confirm').mockReturnValue(false)

    render(<SessionManager clubId="TEST" seasonNumber={1} players={players} />)
    const trigger = await screen.findByRole('button', { name: 'Session actions' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('menuitem', { name: /Reset Session/i }))

    expect(screen.queryByRole('menu', { name: 'Session actions' })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(trigger))
  })
})
