import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { loadSessionPointTotalsMock } = vi.hoisted(() => ({
  loadSessionPointTotalsMock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  usePathname: () => '/club/ABC123/table/1',
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1' }, loading: false }),
}))

vi.mock('@/contexts/GameSyncContext', () => ({
  useGameSync: () => ({
    pendingCount: 0,
    attentionCount: 0,
    online: true,
  }),
}))

vi.mock('@/lib/data', () => ({
  loadSessionPointTotals: loadSessionPointTotalsMock,
}))

import {
  FloatingSessionTrackerProvider,
  useFloatingSessionTracker,
} from '@/contexts/FloatingSessionTrackerContext'
import FloatingSessionTracker from '@/components/FloatingSessionTracker'

function Probe() {
  const { state, enableFloat, disableFloat, setFloatHours, isFloatingFor } =
    useFloatingSessionTracker()
  return (
    <div>
      <p data-testid="enabled">{String(Boolean(state?.enabled))}</p>
      <p data-testid="club">{state?.clubId ?? ''}</p>
      <p data-testid="hours">{String(state?.hours ?? '')}</p>
      <p data-testid="match">
        {String(isFloatingFor('ABC123', 'p1', 24))}
      </p>
      <button
        type="button"
        onClick={() =>
          enableFloat({
            clubId: 'abc123',
            clubName: 'Test Club',
            playerId: 'p1',
            playerName: 'Jane',
            playerIcon: '🐎',
            hours: 24,
          })
        }
      >
        Enable
      </button>
      <button type="button" onClick={() => setFloatHours(48)}>
        Set 48h
      </button>
      <button type="button" onClick={() => disableFloat()}>
        Disable
      </button>
    </div>
  )
}

describe('FloatingSessionTrackerContext', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('enables, persists, and disables the floating tracker', async () => {
    render(
      <FloatingSessionTrackerProvider>
        <Probe />
      </FloatingSessionTrackerProvider>,
    )

    expect(screen.getByTestId('enabled').textContent).toBe('false')

    await act(async () => {
      screen.getByRole('button', { name: 'Enable' }).click()
    })

    expect(screen.getByTestId('enabled').textContent).toBe('true')
    expect(screen.getByTestId('club').textContent).toBe('ABC123')
    expect(screen.getByTestId('hours').textContent).toBe('24')
    expect(screen.getByTestId('match').textContent).toBe('true')
    expect(
      window.localStorage.getItem('mahjong:floating-session-tracker:v1'),
    ).toContain('ABC123')

    await act(async () => {
      screen.getByRole('button', { name: 'Set 48h' }).click()
    })

    expect(screen.getByTestId('hours').textContent).toBe('48')
    expect(
      window.localStorage.getItem('mahjong:floating-session-tracker:v1'),
    ).toContain('"hours":48')

    await act(async () => {
      screen.getByRole('button', { name: 'Disable' }).click()
    })

    expect(screen.getByTestId('enabled').textContent).toBe('false')
    expect(
      window.localStorage.getItem('mahjong:floating-session-tracker:v1'),
    ).toBeNull()
  })
})

describe('FloatingSessionTracker visibility', () => {
  beforeEach(() => {
    window.localStorage.clear()
    loadSessionPointTotalsMock.mockResolvedValue({
      hours: 24,
      totals: [
        {
          playerId: 'p1',
          displayName: 'Jane',
          icon: '🐎',
          netPoints: -50,
          games: 5,
        },
      ],
    })
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
    loadSessionPointTotalsMock.mockReset()
  })

  it('renders on the pinned club path and shows net change', async () => {
    window.localStorage.setItem(
      'mahjong:floating-session-tracker:v1',
      JSON.stringify({
        enabled: true,
        clubId: 'ABC123',
        clubName: 'Test Club',
        playerId: 'p1',
        playerName: 'Jane',
        playerIcon: '🐎',
        hours: 24,
      }),
    )

    render(
      <FloatingSessionTrackerProvider>
        <FloatingSessionTracker />
      </FloatingSessionTrackerProvider>,
    )

    const chip = await screen.findByLabelText('Floating session tracker')
    expect(chip.className).toContain('floating-session-tracker')
    expect(await screen.findByText('-50')).toBeTruthy()
    expect(screen.getByText('24h')).toBeTruthy()
  })

  it('opens window options and updates the tag on select', async () => {
    window.localStorage.setItem(
      'mahjong:floating-session-tracker:v1',
      JSON.stringify({
        enabled: true,
        clubId: 'ABC123',
        clubName: 'Test Club',
        playerId: 'p1',
        playerName: 'Jane',
        playerIcon: '🐎',
        hours: 24,
      }),
    )
    loadSessionPointTotalsMock
      .mockResolvedValueOnce({
        hours: 24,
        totals: [
          {
            playerId: 'p1',
            displayName: 'Jane',
            icon: '🐎',
            netPoints: -50,
            games: 5,
          },
        ],
      })
      .mockResolvedValue({
        hours: 48,
        totals: [
          {
            playerId: 'p1',
            displayName: 'Jane',
            icon: '🐎',
            netPoints: 10,
            games: 3,
          },
        ],
      })

    render(
      <FloatingSessionTrackerProvider>
        <FloatingSessionTracker />
      </FloatingSessionTrackerProvider>,
    )

    await screen.findByText('24h')
    await act(async () => {
      screen.getByRole('button', { name: 'Change session window' }).click()
    })

    expect(screen.getByLabelText('Session window')).toBeTruthy()

    await act(async () => {
      screen.getByRole('option', { name: '48h' }).click()
    })

    expect(screen.queryByLabelText('Session window')).toBeNull()
    expect(await screen.findByText('48h')).toBeTruthy()
    expect(
      window.localStorage.getItem('mahjong:floating-session-tracker:v1'),
    ).toContain('"hours":48')
    expect(loadSessionPointTotalsMock).toHaveBeenCalledWith('ABC123', 48)
  })
})
