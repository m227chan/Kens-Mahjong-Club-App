import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
  subscribeScoringRules: vi.fn(() => vi.fn()),
  subscribeTitleRules: vi.fn(() => vi.fn()),
  subscribeActivitySettings: vi.fn(() => vi.fn()),
  subscribeSeasons: vi.fn((_clubId: string, callback: (seasons: unknown[]) => void) => {
    callback([
      { id: '1', seasonNumber: 1, name: 'Season 1', kind: 'season', active: false },
      { id: '2', seasonNumber: 2, name: 'Season 2', kind: 'season', active: true },
      { id: '3', seasonNumber: 3, name: 'Summer Open', kind: 'tournament', active: false },
    ])
    return vi.fn()
  }),
  subscribeJoinRequests: vi.fn(() => vi.fn()),
  ensureConfig: vi.fn().mockResolvedValue(undefined),
  ensureSeasons: vi.fn().mockResolvedValue(undefined),
  setActiveSeason: vi.fn(),
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
vi.mock('@/components/Leaderboard', () => ({ LeaderboardPanel: ({ seasonNumber }: { seasonNumber: number }) => <div data-testid="leaderboard-season">{seasonNumber}</div> }))
vi.mock('@/components/SessionManager', () => ({ default: ({ seasonNumber }: { seasonNumber: number }) => <div data-testid="session-season">{seasonNumber}</div> }))
vi.mock('@/components/DashboardContent', () => ({ default: () => null }))
vi.mock('@/components/GameLogsModal', () => ({ default: () => null }))
vi.mock('@/components/NetworkGraphModal', () => ({ default: () => null }))
vi.mock('@/components/ScoringRulesSettings', () => ({ default: () => null }))
vi.mock('@/components/TitleRulesSettings', () => ({ default: () => null }))
vi.mock('@/components/ActivitySettings', () => ({ default: () => null }))
vi.mock('@/components/ClubToolSidebar', () => ({
  default: ({ onAnalytics, onSettings }: { onAnalytics: () => void; onSettings: () => void }) => <>
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

describe('club season navigation', () => {
  beforeEach(() => vi.clearAllMocks())
  afterEach(() => cleanup())

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

  it('lets a manager start a custom-named tournament from season controls', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<ClubWorkspace clubId="CLUB1" membership={managerMembership} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open settings' }))
    const nameInput = screen.getByLabelText(/Tournament name/)
    expect(nameInput.getAttribute('placeholder')).toBe('Tournament 2')

    fireEvent.change(nameInput, { target: { value: 'Summer Open' } })
    fireEvent.click(screen.getByRole('button', { name: 'Start tournament' }))

    await waitFor(() => expect(dataMocks.startNewTournament).toHaveBeenCalledWith('CLUB1', {
      createdBy: 'member-1',
      name: 'Summer Open',
    }))
    expect(screen.queryByRole('dialog', { name: 'Test Club' })).toBeNull()
    confirm.mockRestore()
  })

  it('opens analytics with All time selected by default', async () => {
    render(<ClubWorkspace clubId="CLUB1" membership={membership} />)

    fireEvent.click(screen.getByRole('button', { name: 'Open analytics' }))

    expect((screen.getByLabelText('Time window for all analytics') as HTMLSelectElement).value).toBe('all')
  })
})
