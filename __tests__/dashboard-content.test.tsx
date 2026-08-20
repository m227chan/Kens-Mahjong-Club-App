import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlayerDoc } from '@/lib/types'
import { allSessionWindow } from '@/lib/session-point-window'

const { loadAnalyticsGamesMock, loadAnalyticsSkillEventsMock } = vi.hoisted(() => ({
  loadAnalyticsGamesMock: vi.fn().mockResolvedValue([]),
  loadAnalyticsSkillEventsMock: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/lib/data', () => ({
  loadAnalyticsGames: loadAnalyticsGamesMock,
  loadAnalyticsSkillEvents: loadAnalyticsSkillEventsMock,
}))
vi.mock('@/contexts/FloatingSessionTrackerContext', () => ({
  useFloatingSessionTracker: () => ({
    enableFloat: vi.fn(),
    isFloatingFor: vi.fn(() => false),
  }),
}))

import DashboardContent from '@/components/DashboardContent'

const players = [
  { id: 'alpha', displayName: 'Alpha', icon: '🀄', authUid: null, title: 'Monk', active: true },
  { id: 'linked', displayName: 'Linked Player', icon: '🐉', authUid: 'user-1', title: 'Monk', active: true },
] as PlayerDoc[]

const renderDashboard = (props?: { initialPlayerId?: string | null; linkedPlayerId?: string | null }) => render(
  <DashboardContent
    clubId="TEST"
    clubName="Test Club"
    seasonNumber={1}
    initialPlayerId={props?.initialPlayerId}
    linkedPlayerId={props?.linkedPlayerId}
    analyticsWindow={allSessionWindow()}
    players={players}
    stats={[]}
    statsReady
  />,
)

describe('analytics player defaults', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('defaults the player deep dive to the signed-in user linked roster player', async () => {
    const view = renderDashboard({ linkedPlayerId: 'linked' })

    await waitFor(() => expect(loadAnalyticsGamesMock).toHaveBeenCalledTimes(1))
    fireEvent.click(screen.getByRole('button', { name: 'Player deep dive' }))

    const playerSelect = await screen.findByLabelText('Player') as HTMLSelectElement
    expect(playerSelect.value).toBe('linked')
    await waitFor(() => expect(loadAnalyticsGamesMock).toHaveBeenCalledTimes(2))

    fireEvent.change(playerSelect, { target: { value: 'alpha' } })
    view.rerender(
      <DashboardContent
        clubId="TEST"
        clubName="Test Club"
        seasonNumber={1}
        linkedPlayerId="linked"
        analyticsWindow={allSessionWindow()}
        players={[...players]}
        stats={[]}
        statsReady
      />,
    )

    await waitFor(() => expect((screen.getByLabelText('Player') as HTMLSelectElement).value).toBe('alpha'))
  })

  it('adopts the linked player when the roster link arrives after the analytics view', async () => {
    const view = renderDashboard({ linkedPlayerId: null })
    fireEvent.click(screen.getByRole('button', { name: 'Player deep dive' }))
    await waitFor(() => expect((screen.getByLabelText('Player') as HTMLSelectElement).value).toBe('alpha'))

    view.rerender(
      <DashboardContent
        clubId="TEST"
        clubName="Test Club"
        seasonNumber={1}
        linkedPlayerId="linked"
        analyticsWindow={allSessionWindow()}
        players={players}
        stats={[]}
        statsReady
      />,
    )

    await waitFor(() => expect((screen.getByLabelText('Player') as HTMLSelectElement).value).toBe('linked'))
  })

  it('keeps an explicitly requested player ahead of the linked-player default', async () => {
    renderDashboard({ initialPlayerId: 'alpha', linkedPlayerId: 'linked' })

    await waitFor(() => expect((screen.getByLabelText('Player') as HTMLSelectElement).value).toBe('alpha'))
    expect(screen.getByRole('button', { name: 'Player deep dive' }).getAttribute('aria-current')).toBe('page')
  })
})
