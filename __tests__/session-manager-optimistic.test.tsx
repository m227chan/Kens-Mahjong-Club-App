import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlayerDoc, SessionDoc } from '@/lib/types'

const { playMock, subscribeActiveSessionMock, tableActionMock } = vi.hoisted(() => ({
  playMock: vi.fn(),
  subscribeActiveSessionMock: vi.fn(),
  tableActionMock: vi.fn(),
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
  updateSession: vi.fn(),
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
    expect(singleTableCollection.className).toContain('is-list')
    expect(singleTableCollection.getAttribute('aria-describedby')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull()
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
      tableCount: 6,
      tables: { '1': [], '2': [], '3': [], '4': ['jane'], '5': [], '6': [] },
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
    expect(tableCollection.className).toContain('is-carousel')
    expect(screen.getByText('Table 4 · 4 of 6')).not.toBeNull()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search tables or players' }), { target: { value: 'Jane' } })
    await waitFor(() => expect(tableCollection.className).toContain('is-list'))
    expect(tableCollection.getAttribute('aria-describedby')).toBeNull()
    expect(screen.queryByRole('button', { name: 'Show all' })).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Clear table search' }))
    await waitFor(() => expect(tableCollection.className).toContain('is-carousel'))
    fireEvent.click(screen.getByRole('button', { name: 'Show all' }))
    expect(tableCollection.className).toContain('is-list')
    expect(screen.getByRole('button', { name: 'Swipe view' })).not.toBeNull()
  }, 10_000)

  it('updates the active table when the mobile table rail snaps', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      return window.setTimeout(() => callback(performance.now()), 0)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => window.clearTimeout(handle))
    const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo')
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: vi.fn() })

    const largeSession = {
      ...activeSession,
      tableCount: 6,
      tables: { '1': [], '2': [], '3': [], '4': ['jane'], '5': [], '6': [] },
    } as unknown as SessionDoc
    subscribeActiveSessionMock.mockImplementation(
      (_clubId: string, _seasonNumber: number, onValue: (session: SessionDoc) => void) => {
        onValue(largeSession)
        return () => undefined
      },
    )

    try {
      render(<SessionManager clubId="TEST" seasonNumber={1} players={players} />)
      expect(await screen.findByRole('button', { name: 'My table 4' })).not.toBeNull()
      const rail = await screen.findByRole('list', { name: 'Session tables' })
      await waitFor(() => expect(rail.querySelectorAll<HTMLElement>('[data-table-id]')).toHaveLength(6))
      Object.defineProperty(rail, 'scrollLeft', { configurable: true, value: 360 })
      rail.querySelectorAll<HTMLElement>('[data-table-id]').forEach((card) => {
        const position = Number(card.dataset.tableId)
        Object.defineProperty(card, 'offsetLeft', {
          configurable: true,
          value: (position - 1) * 360,
        })
      })

      fireEvent.scroll(rail)

      await waitFor(() => expect(screen.getByRole('button', { name: /Jump to Table 2/i }).getAttribute('aria-pressed')).toBe('true'))
      expect(screen.getByText('Table 2 · 2 of 6')).not.toBeNull()
    } finally {
      if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollTo)
      else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo
    }
  }, 10_000)

  it('centers the active table when the viewport rotates into the mobile layout', async () => {
    const mobileLayoutChanges: Array<() => void> = []
    const mobileQuery = {
      matches: false,
      media: '(max-width: 767px)',
      addEventListener: vi.fn((_type: string, listener: () => void) => { mobileLayoutChanges.push(listener) }),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
    }
    vi.stubGlobal('matchMedia', vi.fn((query: string) => query === mobileQuery.media
      ? mobileQuery
      : { ...mobileQuery, matches: false, media: query }))
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      return window.setTimeout(() => callback(performance.now()), 0)
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((handle) => window.clearTimeout(handle))
    const originalScrollTo = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'scrollTo')
    const scrollTo = vi.fn()
    Object.defineProperty(HTMLElement.prototype, 'scrollTo', { configurable: true, value: scrollTo })

    const largeSession = {
      ...activeSession,
      tableCount: 6,
      tables: { '1': [], '2': [], '3': [], '4': ['jane'], '5': [], '6': [] },
    } as unknown as SessionDoc
    subscribeActiveSessionMock.mockImplementation(
      (_clubId: string, _seasonNumber: number, onValue: (session: SessionDoc) => void) => {
        onValue(largeSession)
        return () => undefined
      },
    )

    try {
      render(<SessionManager clubId="TEST" seasonNumber={1} players={players} />)
      expect(await screen.findByRole('button', { name: 'My table 4' })).not.toBeNull()
      const activeCard = await screen.findByRole('listitem', { name: /Table 4.*your table/i })
      Object.defineProperty(activeCard, 'offsetLeft', { configurable: true, value: 1080 })
      expect(scrollTo).not.toHaveBeenCalled()

      mobileQuery.matches = true
      mobileLayoutChanges[0]?.()

      await waitFor(() => expect(scrollTo).toHaveBeenCalledWith({ left: 1080, behavior: 'auto' }))
    } finally {
      if (originalScrollTo) Object.defineProperty(HTMLElement.prototype, 'scrollTo', originalScrollTo)
      else delete (HTMLElement.prototype as Partial<HTMLElement>).scrollTo
    }
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
    fireEvent.click(screen.getByRole('button', { name: /Add player/i }))

    expect(onAddPlayer).toHaveBeenCalledOnce()
    expect(screen.queryByRole('dialog', { name: 'Session actions' })).toBeNull()
  })
})
