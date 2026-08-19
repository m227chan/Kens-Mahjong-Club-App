import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from '@/lib/timestamp'
import type { ClubMembershipDoc } from '@/lib/types'

const dataMocks = vi.hoisted(() => ({
  subscribeClub: vi.fn((_clubId: string, callback: (club: unknown) => void) => {
    callback({ id: 'CLUB1', name: 'Test Club', activeSeasonNumber: 1, active: true })
    return vi.fn()
  }),
  subscribeClubMembers: vi.fn((_clubId: string, callback: (members: unknown[]) => void) => { callback([]); return vi.fn() }),
  subscribePlayers: vi.fn((_clubId: string, callback: (players: unknown[]) => void) => {
    callback([
      { id: 'p1', displayName: 'Alice', icon: '🀄', authUid: null },
      { id: 'p2', displayName: 'Bob', icon: '🏆', authUid: null },
    ])
    return vi.fn()
  }),
  subscribePlayerStats: vi.fn((_clubId: string, callback: (stats: unknown[]) => void) => { callback([]); return vi.fn() }),
  subscribeAllCompetitionStats: vi.fn((_clubId: string, callback: (stats: unknown[]) => void) => { callback([]); return vi.fn() }),
  subscribeScoringRules: vi.fn(() => vi.fn()),
  subscribeTitleRules: vi.fn(() => vi.fn()),
  subscribeActivitySettings: vi.fn(() => vi.fn()),
  subscribeSeasons: vi.fn((_clubId: string, callback: (seasons: unknown[]) => void) => {
    callback([{ id: '1', seasonNumber: 1, name: 'Season 1', active: true }])
    return vi.fn()
  }),
  subscribeJoinRequests: vi.fn(() => vi.fn()),
  ensureConfig: vi.fn().mockResolvedValue(undefined),
  ensureSeasons: vi.fn().mockResolvedValue(undefined),
  setActiveSeason: vi.fn(),
  startNewSeason: vi.fn(),
  startNewTournament: vi.fn(),
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
vi.mock('@/components/Leaderboard', () => ({ LeaderboardPanel: () => null }))
vi.mock('@/components/SessionManager', () => ({
  default: ({ onAddPlayer }: { onAddPlayer?: () => void }) => onAddPlayer
    ? <button type="button" onClick={onAddPlayer}>Add player from session</button>
    : null,
}))
vi.mock('@/components/DashboardContent', () => ({ default: () => null }))
vi.mock('@/components/GameLogsModal', () => ({ default: () => null }))
vi.mock('@/components/NetworkGraphModal', () => ({ default: () => null }))
vi.mock('@/components/ScoringRulesSettings', () => ({ default: () => null }))
vi.mock('@/components/TitleRulesSettings', () => ({ default: () => null }))
vi.mock('@/components/ActivitySettings', () => ({ default: () => null }))
vi.mock('embla-carousel-react', () => ({ default: () => [vi.fn(), undefined] }))
vi.mock('@/components/ClubToolSidebar', () => ({
  default: ({ onRoster }: { onRoster: () => void }) => <button type="button" onClick={onRoster}>Open roster</button>,
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

describe('club roster emoji picker', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

  it('refreshes available suggestions and closes on outside taps or roster exit', () => {
    const random = vi.spyOn(Math, 'random').mockReturnValue(0)
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open roster' }))
    const emojiField = screen.getByLabelText('Player emoji')
    fireEvent.focus(emojiField)

    const firstPicker = screen.getByRole('group', { name: 'Available emoji options' })
    const firstSuggestions = within(firstPicker).getAllByRole('button').map((button) => button.textContent)
    expect(firstSuggestions).toHaveLength(16)
    expect(firstSuggestions).not.toContain('🀄')
    expect(firstSuggestions).not.toContain('🏆')

    fireEvent.pointerDown(screen.getByLabelText('Player name'))
    expect(screen.queryByRole('group', { name: 'Available emoji options' })).toBeNull()

    random.mockReturnValue(0.999999)
    fireEvent.click(emojiField)
    const secondPicker = screen.getByRole('group', { name: 'Available emoji options' })
    const secondSuggestions = within(secondPicker).getAllByRole('button').map((button) => button.textContent)
    expect(secondSuggestions).not.toEqual(firstSuggestions)

    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog', { name: 'Players and linked users' })).toBeNull()
    expect(screen.queryByRole('group', { name: 'Available emoji options' })).toBeNull()

    random.mockRestore()
  })

  it('opens the roster from the session add-player action', () => {
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)

    fireEvent.click(screen.getByRole('button', { name: 'Add player from session' }))

    expect(screen.getByRole('dialog', { name: 'Players and linked users' })).not.toBeNull()
    expect(screen.getByRole('heading', { name: 'Add player' })).not.toBeNull()
  })

  it('filters existing roster players by name', () => {
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)
    fireEvent.click(screen.getByRole('button', { name: 'Open roster' }))

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search roster players' }), { target: { value: 'ali' } })

    expect(screen.getByText('Alice')).not.toBeNull()
    expect(screen.queryByText('Bob')).toBeNull()
    expect(screen.getByText('1 of 2')).not.toBeNull()

    fireEvent.change(screen.getByRole('searchbox', { name: 'Search roster players' }), { target: { value: 'missing' } })
    expect(screen.getByText('No roster players match “missing”.')).not.toBeNull()
  })
})
