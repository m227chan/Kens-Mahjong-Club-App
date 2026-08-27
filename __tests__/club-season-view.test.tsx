import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from '@/lib/timestamp'
import type { ClubMembershipDoc } from '@/lib/types'

const dataMocks = vi.hoisted(() => ({
  subscribeClub: vi.fn((_clubId: string, callback: (club: unknown) => void) => {
    callback({ id: 'CLUB1', name: 'Test Club', activeSeasonNumber: 2, active: true })
    return vi.fn()
  }),
  subscribeClubMembers: vi.fn((_clubId: string, callback: (members: unknown[]) => void) => { callback([]); return vi.fn() }),
  subscribePlayers: vi.fn((_clubId: string, callback: (players: unknown[]) => void) => { callback([]); return vi.fn() }),
  subscribePlayerStats: vi.fn((_clubId: string, callback: (stats: unknown[]) => void) => { callback([]); return vi.fn() }),
  subscribeAllCompetitionStats: vi.fn((_clubId: string, callback: (stats: unknown[]) => void) => { callback([]); return vi.fn() }),
  subscribeScoringRules: vi.fn(() => vi.fn()),
  subscribeTitleRules: vi.fn(() => vi.fn()),
  subscribeActivitySettings: vi.fn(() => vi.fn()),
  subscribeSeasons: vi.fn((_clubId: string, callback: (seasons: unknown[]) => void) => {
    callback([
      { id: '1', seasonNumber: 1, name: 'Season 1', kind: 'season', active: false },
      { id: '2', seasonNumber: 2, name: 'Season 2', kind: 'season', active: true },
      { id: '3', seasonNumber: 3, name: 'Summer Open', kind: 'tournament', active: false, editableUntil: { toMillis: () => Date.now() + 24 * 60 * 60 * 1000 }, tournamentDurationHours: 24 },
    ])
    return vi.fn()
  }),
  subscribeJoinRequests: vi.fn(() => vi.fn()),
  ensureConfig: vi.fn().mockResolvedValue(undefined),
  ensureSeasons: vi.fn().mockResolvedValue(undefined),
  setActiveSeason: vi.fn(),
  setCurrentCompetition: vi.fn(),
  reopenTournament: vi.fn(),
  updateTournamentDuration: vi.fn(),
  endTournament: vi.fn(),
  deleteTournament: vi.fn(),
  startNewSeason: vi.fn().mockResolvedValue(3),
  startNewTournament: vi.fn().mockResolvedValue({ seasonNumber: 4, name: 'Tournament 2', kind: 'tournament' }),
  createPlayer: vi.fn(),
  deleteClub: vi.fn(),
  removePlayer: vi.fn(),
  rebuildClubStats: vi.fn(),
  promoteManagerByEmail: vi.fn(),
  resolveJoinRequest: vi.fn(),
  setPlayerAuthLink: vi.fn(),
  updatePlayerIcon: vi.fn(),
  updatePlayerName: vi.fn(),
}))

vi.mock('@/lib/data', () => dataMocks)
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }))
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => ({ user: { uid: 'member-1', email: 'member@example.com' } }) }))
vi.mock('@/contexts/SoundContext', () => ({ useSound: () => ({ play: vi.fn() }) }))
vi.mock('@/components/Leaderboard', () => ({ LeaderboardPanel: ({ seasonNumber }: { seasonNumber?: number }) => <div data-testid="leaderboard-season">{seasonNumber ?? 'all'}</div> }))
vi.mock('@/components/SessionManager', () => ({ default: ({ seasonNumber }: { seasonNumber: number }) => <div data-testid="session-season">{seasonNumber}</div> }))
vi.mock('@/components/DashboardContent', () => ({ default: ({ seasonNumber }: { seasonNumber?: number }) => <div data-testid="analytics-season">{seasonNumber ?? 'all'}</div> }))
vi.mock('@/components/GameLogsModal', () => ({ default: () => null }))
vi.mock('@/components/NetworkGraphModal', () => ({ default: () => null }))
vi.mock('@/components/ScoringRulesSettings', () => ({ default: ({ embedded }: { embedded?: boolean }) => <output data-testid="scoring-settings-mode">{embedded ? 'embedded' : 'card'}</output> }))
vi.mock('@/components/TitleRulesSettings', () => ({ default: ({ embedded }: { embedded?: boolean }) => <output data-testid="title-settings-mode">{embedded ? 'embedded' : 'card'}</output> }))
vi.mock('@/components/ActivitySettings', () => ({ default: () => null }))
const emblaMock = vi.hoisted(() => {
  type Handler = (api: unknown, event: string) => void
  const handlers = new Map<string, Set<Handler>>()
  let selected = 0
  let progress = 0
  let viewportNode: HTMLElement | null = null
  const api = {} as {
    on: ReturnType<typeof vi.fn>
    off: ReturnType<typeof vi.fn>
    scrollTo: ReturnType<typeof vi.fn>
    selectedScrollSnap: ReturnType<typeof vi.fn>
    scrollProgress: ReturnType<typeof vi.fn>
    containerNode: ReturnType<typeof vi.fn>
    slideNodes: ReturnType<typeof vi.fn>
  }
  const emit = (event: string) => {
    handlers.get(event)?.forEach((handler) => handler(api, event))
  }
  api.on = vi.fn((event: string, handler: Handler) => {
    const eventHandlers = handlers.get(event) ?? new Set<Handler>()
    eventHandlers.add(handler)
    handlers.set(event, eventHandlers)
    return api
  })
  api.off = vi.fn((event: string, handler: Handler) => {
    handlers.get(event)?.delete(handler)
    return api
  })
  api.scrollTo = vi.fn((index: number) => {
    emit('pointerDown')
    selected = index
    progress = index
    emit('scroll')
    emit('select')
    emit('settle')
  })
  api.selectedScrollSnap = vi.fn(() => selected)
  api.scrollProgress = vi.fn(() => progress)
  api.containerNode = vi.fn(() => viewportNode?.firstElementChild as HTMLElement)
  api.slideNodes = vi.fn(() => Array.from(viewportNode?.querySelectorAll<HTMLElement>('.club-mobile-panel') ?? []))

  return {
    api,
    options: undefined as Record<string, unknown> | undefined,
    viewportRef: vi.fn((node: HTMLElement | null) => { viewportNode = node }),
    reset() {
      handlers.clear()
      selected = 0
      progress = 0
      viewportNode = null
      this.options = undefined
    },
    dragTo(index: number, intermediateProgress = index) {
      emit('pointerDown')
      progress = intermediateProgress
      emit('scroll')
      selected = index
      progress = index
      emit('select')
      emit('settle')
    },
    setProgress(value: number) {
      progress = value
      emit('scroll')
    },
    emit,
  }
})
vi.mock('embla-carousel-react', () => ({ default: (options: Record<string, unknown>) => {
  emblaMock.options = options
  return [emblaMock.viewportRef, emblaMock.api]
} }))
vi.mock('@/components/ClubToolSidebar', () => ({
  default: ({ expanded, onAnalytics, onExpandedChange, onSettings }: { expanded: boolean; onAnalytics: () => void; onExpandedChange: (value: boolean) => void; onSettings: () => void }) => <>
    <output data-testid="club-sidebar-expanded">{String(expanded)}</output>
    <button type="button" onClick={() => onExpandedChange(false)}>Collapse club tools</button>
    <button type="button" onClick={onAnalytics}>Open analytics</button>
    <button type="button" onClick={onSettings}>Open settings</button>
  </>,
}))

import ClubWorkspace from '@/components/ClubWorkspace'

const membership = {
  clubId: 'CLUB1',
  clubName: 'Test Club',
  uid: 'member-1',
  email: 'member@example.com',
  displayName: 'Member',
  role: 'member',
  joinedAt: Timestamp.now(),
  active: true,
} satisfies ClubMembershipDoc

const managerMembership = { ...membership, role: 'manager' as const }

function swipe(element: Element, from: { x: number; y: number }, to: { x: number; y: number }) {
  fireEvent.touchStart(element, { touches: [{ clientX: from.x, clientY: from.y }] })
  fireEvent.touchMove(element, { touches: [{ clientX: to.x, clientY: to.y }] })
  fireEvent.touchEnd(element, { changedTouches: [{ clientX: to.x, clientY: to.y }] })
}

describe('club season navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    emblaMock.reset()
    window.localStorage.clear()
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(min-width: 768px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
  })
  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
  })

  it('shows the desktop sidebar by default and remembers a user collapse', async () => {
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)

    await waitFor(() => expect(screen.getByTestId('club-sidebar-expanded').textContent).toBe('true'))
    fireEvent.click(screen.getByRole('button', { name: 'Collapse club tools' }))

    expect(screen.getByTestId('club-sidebar-expanded').textContent).toBe('false')
    expect(window.localStorage.getItem('club-tools-sidebar')).toBe('collapsed')
  })

  it('keeps Club Tools available in the sticky mobile workspace bar', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: false,
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)

    await waitFor(() => expect(screen.getByTestId('club-sidebar-expanded').textContent).toBe('false'))
    fireEvent.click(screen.getByRole('button', { name: 'Open club tools' }))

    expect(screen.getByTestId('club-sidebar-expanded').textContent).toBe('true')
  })

  it('keeps the glass selector and swipeable panels synchronized on mobile', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)

    const workspace = document.querySelector('.club-workspace-shell')
    expect(workspace).not.toBeNull()
    const sessionButton = screen.getByRole('button', { name: 'Session' })
    const leaderboardButton = screen.getByRole('button', { name: 'Leaderboard' })
    const toolsButton = screen.getByRole('button', { name: 'Open club tools' })
    const sessionPanel = document.querySelector('#club-session-view')!
    const leaderboardPanel = document.querySelector('#club-leaderboard-view')!

    expect(sessionButton.getAttribute('aria-pressed')).toBe('true')
    expect(sessionPanel.hasAttribute('inert')).toBe(false)
    expect(leaderboardPanel.hasAttribute('inert')).toBe(true)
    expect(screen.getByRole('option', { name: 'Season 2' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Season 2 (current)' })).toBeNull()

    act(() => emblaMock.dragTo(1))
    expect(leaderboardButton.getAttribute('aria-pressed')).toBe('true')
    expect(sessionPanel.hasAttribute('inert')).toBe(true)
    expect(leaderboardPanel.hasAttribute('inert')).toBe(false)

    fireEvent.click(sessionButton)
    expect(emblaMock.api.scrollTo).toHaveBeenLastCalledWith(0)
    expect(sessionButton.getAttribute('aria-pressed')).toBe('true')

    swipe(workspace!, { x: 120, y: 200 }, { x: 300, y: 205 })
    expect(screen.getByTestId('club-sidebar-expanded').textContent).toBe('true')
    expect(toolsButton.className).toContain('active')
    expect(sessionButton.getAttribute('aria-pressed')).toBe('false')

    swipe(workspace!, { x: 300, y: 200 }, { x: 120, y: 205 })
    expect(screen.getByTestId('club-sidebar-expanded').textContent).toBe('false')
    expect(sessionButton.getAttribute('aria-pressed')).toBe('true')
  })

  it('moves the glass indicator with the panel drag and lets it settle', () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)

    const navigation = document.querySelector<HTMLElement>('.mobile-workspace-tabs')!
    const controls = navigation.querySelectorAll<HTMLElement>('.mobile-workspace-tab')
    Object.defineProperty(controls[0], 'offsetLeft', { configurable: true, value: 0 })
    Object.defineProperty(controls[1], 'offsetLeft', { configurable: true, value: 100 })
    Object.defineProperty(controls[2], 'offsetLeft', { configurable: true, value: 200 })

    act(() => {
      emblaMock.emit('pointerDown')
      emblaMock.setProgress(.5)
    })
    expect(navigation.getAttribute('data-carousel-moving')).toBe('true')
    expect(navigation.style.getPropertyValue('--mobile-workspace-indicator-x')).toBe('150px')

    act(() => emblaMock.emit('settle'))
    expect(navigation.hasAttribute('data-carousel-moving')).toBe(false)
  })

  it('keeps the mobile viewport fitted to the active panel as its content changes', () => {
    let notifyResize: (() => void) | null = null
    class MockResizeObserver {
      constructor(callback: ResizeObserverCallback) {
        notifyResize = () => callback([], this as unknown as ResizeObserver)
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    vi.stubGlobal('ResizeObserver', MockResizeObserver)
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    const requestAnimationFrame = vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)

    const track = document.querySelector<HTMLElement>('.club-mobile-panels-track')!
    const sessionPanel = document.querySelector<HTMLElement>('#club-session-view')!
    const leaderboardPanel = document.querySelector<HTMLElement>('#club-leaderboard-view')!
    Object.defineProperty(sessionPanel, 'scrollHeight', { configurable: true, value: 720 })
    Object.defineProperty(leaderboardPanel, 'scrollHeight', { configurable: true, value: 480 })

    act(() => { notifyResize?.() })
    expect(track.style.height).toBe('720px')

    act(() => emblaMock.dragTo(1))
    expect(track.style.height).toBe('480px')
    requestAnimationFrame.mockRestore()
  })

  it('does not turn vertical, short, interactive, or desktop gestures into workspace navigation', () => {
    const matchMedia = vi.fn((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    vi.stubGlobal('matchMedia', matchMedia)
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)

    const workspace = document.querySelector('.club-workspace-shell')!
    const sessionButton = screen.getByRole('button', { name: 'Session' })
    const leaderboardButton = screen.getByRole('button', { name: 'Leaderboard' })

    swipe(workspace, { x: 250, y: 100 }, { x: 230, y: 240 })
    swipe(workspace, { x: 250, y: 100 }, { x: 210, y: 105 })
    swipe(sessionButton, { x: 250, y: 100 }, { x: 100, y: 105 })
    expect(sessionButton.getAttribute('aria-pressed')).toBe('true')

    matchMedia.mockImplementation((query: string) => ({
      matches: query === '(min-width: 768px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    }))
    swipe(workspace, { x: 250, y: 100 }, { x: 100, y: 105 })
    expect(leaderboardButton.getAttribute('aria-pressed')).toBe('false')
  })

  it('allows panel swipes to begin on buttons while preserving nested gesture controls', () => {
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)

    const watchDrag = emblaMock.options?.watchDrag as ((api: unknown, event: { target: EventTarget | null }) => boolean)
    const ordinaryButton = screen.getByRole('button', { name: 'Leaderboard' })
    const ignoredControl = document.createElement('button')
    ignoredControl.setAttribute('data-workspace-swipe-ignore', '')
    const textInput = document.createElement('input')

    expect(watchDrag(null, { target: ordinaryButton })).toBe(true)
    expect(watchDrag(null, { target: ignoredControl })).toBe(false)
    expect(watchDrag(null, { target: textInput })).toBe(false)
  })

  it('keeps both workspace panels available on desktop', () => {
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)

    const sessionPanel = document.querySelector('#club-session-view')!
    const leaderboardPanel = document.querySelector('#club-leaderboard-view')!
    expect(sessionPanel.hasAttribute('aria-hidden')).toBe(false)
    expect(sessionPanel.hasAttribute('inert')).toBe(false)
    expect(leaderboardPanel.hasAttribute('aria-hidden')).toBe(false)
    expect(leaderboardPanel.hasAttribute('inert')).toBe(false)
    expect(screen.getByTestId('session-season')).toBeTruthy()
    expect(screen.getByTestId('leaderboard-season')).toBeTruthy()
  })

  it('lets any member view a historical season without changing the live club season', async () => {
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)

    await waitFor(() => expect((screen.getByLabelText('Season') as HTMLSelectElement).value).toBe('2'))
    expect(screen.getByRole('option', { name: 'Summer Open · Tournament' })).toBeTruthy()
    expect(screen.getByTestId('session-season').textContent).toBe('2')

    fireEvent.change(screen.getByLabelText('Season'), { target: { value: '1' } })

    await waitFor(() => expect(screen.getByTestId('leaderboard-season').textContent).toBe('1'))
    expect(screen.getByText('Season 1 is read-only')).toBeTruthy()
    expect(screen.queryByTestId('session-season')).toBeNull()
    expect(dataMocks.setActiveSeason).not.toHaveBeenCalled()
    expect(dataMocks.subscribePlayerStats).toHaveBeenLastCalledWith('CLUB1', expect.any(Function), 1)

    fireEvent.click(screen.getByRole('button', { name: 'Return to current' }))
    await waitFor(() => expect(screen.getByTestId('session-season').textContent).toBe('2'))
  })

  it('uses one colored status dot and shows the countdown for the current tournament without replacing the active season', async () => {
    dataMocks.subscribeClub.mockImplementationOnce((_clubId: string, callback: (club: unknown) => void) => {
      callback({ id: 'CLUB1', name: 'Test Club', activeSeasonNumber: 2, currentCompetitionNumber: 3, active: true })
      return vi.fn()
    })
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)

    const selector = screen.getByLabelText('Season')
    expect(document.querySelectorAll('.club-season-action > .competition-status-dot')).toHaveLength(1)
    await waitFor(() => expect((selector as HTMLSelectElement).value).toBe('3'))
    expect(document.querySelector('.club-season-action > .competition-status-dot')?.classList.contains('is-tournament-editable')).toBe(true)
    const timer = screen.getByRole('timer')
    expect(timer.getAttribute('aria-label')).toContain('Summer Open tournament clock')
    expect(within(timer).queryByText('Summer Open')).toBeNull()
    expect(screen.queryByText(/current/i, { selector: 'option' })).toBeNull()
    await waitFor(() => expect(screen.getByTestId('session-season').textContent).toBe('3'))
    expect(dataMocks.setActiveSeason).not.toHaveBeenCalled()
  })

  it('keeps the season selector view-only and lets managers inspect an ended tournament', async () => {
    dataMocks.subscribeSeasons.mockImplementationOnce((_clubId: string, callback: (seasons: unknown[]) => void) => {
      callback([
        { id: '1', seasonNumber: 1, name: 'Season 1', kind: 'season', active: false },
        { id: '2', seasonNumber: 2, name: 'Season 2', kind: 'season', active: true },
        { id: '3', seasonNumber: 3, name: 'Test 2', kind: 'tournament', active: false, editableUntil: null, tournamentSecondsRemaining: 0, tournamentDurationHours: 24 },
      ])
      return vi.fn()
    })
    render(<ClubWorkspace clubId="CLUB1" membership={managerMembership} />)

    const selector = screen.getByLabelText('Season')
    fireEvent.change(selector, { target: { value: '3' } })

    await waitFor(() => expect((selector as HTMLSelectElement).value).toBe('3'))
    expect(screen.getByText('Test 2 is read-only')).toBeTruthy()
    expect(screen.getByTestId('leaderboard-season').textContent).toBe('3')
    expect(dataMocks.setCurrentCompetition).not.toHaveBeenCalled()
  })

  it('moves every member to a newly current competition when the club update arrives', async () => {
    let publishClub: ((club: unknown) => void) | null = null
    dataMocks.subscribeClub.mockImplementationOnce((_clubId: string, callback: (club: unknown) => void) => {
      publishClub = callback
      callback({ id: 'CLUB1', name: 'Test Club', activeSeasonNumber: 2, currentCompetitionNumber: 2, active: true })
      return vi.fn()
    })
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)
    const selector = screen.getByLabelText('Season')
    fireEvent.change(selector, { target: { value: '1' } })
    await waitFor(() => expect((selector as HTMLSelectElement).value).toBe('1'))

    act(() => publishClub?.({ id: 'CLUB1', name: 'Test Club', activeSeasonNumber: 2, currentCompetitionNumber: 3, active: true }))

    await waitFor(() => expect((selector as HTMLSelectElement).value).toBe('3'))
    expect(screen.getByRole('timer').getAttribute('aria-label')).toContain('Summer Open tournament clock')
  })

  it('combines every season and tournament in leaderboard and analytics', async () => {
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)

    await waitFor(() => expect((screen.getByLabelText('Season') as HTMLSelectElement).value).toBe('2'))
    expect(screen.getByRole('option', { name: 'All-time club history' })).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Season'), { target: { value: 'all' } })

    await waitFor(() => expect(screen.getByTestId('leaderboard-season').textContent).toBe('all'))
    expect(dataMocks.subscribeAllCompetitionStats).toHaveBeenCalledWith('CLUB1', expect.any(Function))
    expect(screen.getByRole('heading', { name: 'All-time club history' })).toBeTruthy()
    expect(screen.queryByTestId('session-season')).toBeNull()

    fireEvent.click(screen.getByRole('button', { name: 'Open analytics' }))
    expect((await screen.findByTestId('analytics-season')).textContent).toBe('all')
  })

  it('lets a manager start a custom-named tournament from season controls', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    dataMocks.subscribeSeasons.mockImplementationOnce((_clubId: string, callback: (seasons: unknown[]) => void) => {
      callback([
        { id: '1', seasonNumber: 1, name: 'Season 1', kind: 'season', active: false },
        { id: '2', seasonNumber: 2, name: 'Season 2', kind: 'season', active: true },
        { id: '3', seasonNumber: 3, name: 'Spring Open', kind: 'tournament', active: false, editableUntil: null, tournamentSecondsRemaining: 0, tournamentDurationHours: 24 },
      ])
      return vi.fn()
    })
    dataMocks.startNewTournament.mockResolvedValueOnce({ seasonNumber: 4, name: 'Summer Open', kind: 'tournament' })
    render(<ClubWorkspace clubId="CLUB1" membership={managerMembership} />)

    const settingsTrigger = screen.getByRole('button', { name: 'Open settings' })
    settingsTrigger.focus()
    fireEvent.click(settingsTrigger)
    expect(screen.getByRole('navigation', { name: 'Club settings' })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Seasons & Tournaments/ }).getAttribute('aria-current')).toBe('page')
    expect(screen.getByRole('heading', { name: 'Seasons & Tournaments' })).toBeTruthy()
    const nameInput = screen.getByLabelText(/Tournament Name/i)
    expect(nameInput.getAttribute('placeholder')).toBe('Tournament 2')

    fireEvent.change(nameInput, { target: { value: 'Summer Open' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start Tournament' }))

    await waitFor(() => expect(dataMocks.startNewTournament).toHaveBeenCalledWith('CLUB1', {
      createdBy: 'member-1',
      name: 'Summer Open',
      durationHours: 24,
    }))
    await waitFor(() => expect((screen.getByLabelText('Season') as HTMLSelectElement).value).toBe('4'))
    expect(screen.getByRole('option', { name: 'Summer Open · Tournament' })).toBeTruthy()
    expect(screen.queryByRole('option', { name: 'Season 4' })).toBeNull()
    expect(document.querySelector('.club-workspace-main')?.classList.contains('tournament-mode')).toBe(true)
    expect(screen.getByRole('timer').getAttribute('aria-label')).toContain('Summer Open tournament clock')
    expect(screen.queryByRole('dialog', { name: 'Test Club' })).toBeNull()
    await waitFor(() => expect(document.activeElement).toBe(settingsTrigger))
    confirm.mockRestore()
  })

  it('explains in settings that another tournament cannot start until the active one ends', () => {
    render(<ClubWorkspace clubId="CLUB1" membership={managerMembership} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))

    expect(screen.getByText(/must wait until Summer Open is over/i)).toBeTruthy()
    expect((screen.getByRole('button', { name: 'Tournament in Progress' }) as HTMLButtonElement).disabled).toBe(true)
  })

  it('changes the shared current tournament only from manager settings', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ClubWorkspace clubId="CLUB1" membership={managerMembership} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))

    fireEvent.click(screen.getByRole('button', { name: 'Make Summer Open current tournament' }))

    await waitFor(() => expect(dataMocks.setCurrentCompetition).toHaveBeenCalledWith('CLUB1', 3))
    expect((screen.getByLabelText('Season') as HTMLSelectElement).value).toBe('3')
    expect(document.querySelector('main')?.classList.contains('tournament-mode')).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.getByRole('timer').getAttribute('aria-label')).toContain('Summer Open tournament clock')
    confirm.mockRestore()
  })

  it('stacks competition controls and lets a manager configure, restart, end, or delete a tournament', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ClubWorkspace clubId="CLUB1" membership={managerMembership} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))

    const competitionList = document.querySelector('.club-competition-list')!
    expect(competitionList.querySelectorAll('.club-competition-row')).toHaveLength(3)
    expect(competitionList.querySelectorAll('article.rounded-lg')).toHaveLength(0)
    expect(competitionList.querySelector('.club-tournament-clock-control')?.className).not.toContain('border')
    fireEvent.click(screen.getByRole('button', { name: 'Set Season 1 as active season' }))
    await waitFor(() => expect(dataMocks.setActiveSeason).toHaveBeenCalledWith('CLUB1', 1))

    const durationInput = screen.getByLabelText('Summer Open clock duration in hours')
    fireEvent.change(durationInput, { target: { value: '36' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save clock duration for Summer Open' }))
    await waitFor(() => expect(dataMocks.updateTournamentDuration).toHaveBeenCalledWith('CLUB1', 3, 36))

    fireEvent.click(screen.getByRole('button', { name: 'Restart clock for Summer Open' }))
    await waitFor(() => expect(dataMocks.reopenTournament).toHaveBeenCalledWith('CLUB1', 3))

    fireEvent.click(screen.getByRole('button', { name: 'End Summer Open' }))
    await waitFor(() => expect(dataMocks.endTournament).toHaveBeenCalledWith('CLUB1', 3))

    fireEvent.click(screen.getByRole('button', { name: 'Delete Summer Open' }))
    expect(screen.queryByLabelText('Summer Open clock duration in hours')).toBeNull()
    await waitFor(() => expect(dataMocks.deleteTournament).toHaveBeenCalledWith('CLUB1', 3))
    confirm.mockRestore()
  })

  it('uses an adaptive mobile settings list with direct, draft-preserving detail editors', async () => {
    vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
      matches: query === '(max-width: 767px)',
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })))
    render(<ClubWorkspace clubId="CLUB1" membership={managerMembership} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))

    const layout = document.querySelector('.club-settings-layout')!
    const navigation = document.querySelector('.club-settings-navigation')!
    const detail = document.querySelector('.club-settings-detail')!
    await waitFor(() => {
      expect(navigation.getAttribute('aria-hidden')).toBeNull()
      expect(detail.getAttribute('aria-hidden')).toBe('true')
    })
    const scoring = screen.getByRole('button', { name: /House Scoring/ })
    fireEvent.click(scoring)

    expect(layout.className).toContain('is-detail-open')
    expect(scoring.getAttribute('aria-current')).toBe('page')
    await waitFor(() => {
      expect(navigation.getAttribute('aria-hidden')).toBe('true')
      expect(detail.getAttribute('aria-hidden')).toBeNull()
      expect(document.activeElement).toBe(screen.getByRole('heading', { name: 'House Scoring' }))
    })
    const scoringEditor = screen.getByTestId('scoring-settings-mode')
    expect(scoringEditor.textContent).toBe('embedded')

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(screen.getByRole('button', { name: /Club Titles/ }))
    expect(scoringEditor.parentElement?.hidden).toBe(true)
    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    fireEvent.click(scoring)
    expect(screen.getByTestId('scoring-settings-mode')).toBe(scoringEditor)
    expect(scoringEditor.parentElement?.hidden).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Settings' }))
    expect(layout.className).not.toContain('is-detail-open')
    expect(navigation.getAttribute('aria-hidden')).toBeNull()
    expect(detail.getAttribute('aria-hidden')).toBe('true')
  })

  it('hands focus to club deletion and returns to its settings row on Escape', async () => {
    render(<ClubWorkspace clubId="CLUB1" membership={managerMembership} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    fireEvent.click(screen.getByRole('button', { name: /Club Access/ }))

    const deleteClubRow = screen.getByRole('button', { name: 'Delete Club…' })
    fireEvent.click(deleteClubRow)

    const confirmation = screen.getByRole('dialog', { name: 'Delete Test Club?' })
    const confirmationInput = screen.getByRole('textbox', { name: 'Type Test Club to confirm club deletion' })
    expect(confirmation).toBeTruthy()
    expect(screen.queryByRole('dialog', { name: 'Test Club' })).toBeNull()
    expect(document.getElementById('club-settings-dialog')?.closest('[aria-hidden="true"]')).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(confirmationInput))

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Delete Test Club?' })).toBeNull()
    expect(screen.getByRole('dialog', { name: 'Test Club' })).toBeTruthy()
    await waitFor(() => expect(document.activeElement).toBe(deleteClubRow))
  })

  it('makes the full underlying app inert while settings are open', async () => {
    const { container } = render(<ClubWorkspace clubId="CLUB1" membership={membership} />)

    const workspace = document.querySelector('.club-workspace-dashboard-grid')
    expect(workspace?.hasAttribute('inert')).toBe(false)

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    expect(workspace?.hasAttribute('inert')).toBe(true)
    await waitFor(() => expect(container.hasAttribute('inert')).toBe(true))

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(workspace?.hasAttribute('inert')).toBe(false)
    expect(container.hasAttribute('inert')).toBe(false)
  })

  it('opens analytics with All time selected by default', async () => {
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open analytics' }))

    expect((screen.getByLabelText('Time window for all analytics') as HTMLSelectElement).value).toBe('all')
  })
})
