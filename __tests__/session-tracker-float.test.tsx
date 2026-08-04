import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { enableFloatMock, isFloatingForMock, loadTotalsMock } = vi.hoisted(() => ({
  enableFloatMock: vi.fn(),
  isFloatingForMock: vi.fn(() => false),
  loadTotalsMock: vi.fn(),
}))

vi.mock('@/contexts/FloatingSessionTrackerContext', () => ({
  useFloatingSessionTracker: () => ({
    enableFloat: enableFloatMock,
    disableFloat: vi.fn(),
    setFloatHours: vi.fn(),
    isFloatingFor: isFloatingForMock,
    state: null,
  }),
}))

vi.mock('@/lib/data', () => ({
  loadSessionPointTotals: loadTotalsMock,
  loadSessionPointBreakdown: vi.fn(),
}))

import SessionPointTrackerModal from '@/components/SessionPointTrackerModal'

const players = [
  { id: 'p1', displayName: 'Jane', icon: '🐎', authUid: 'user-1' },
  { id: 'p2', displayName: 'Bob', icon: '🏆', authUid: null },
]

describe('SessionPointTrackerModal float control', () => {
  beforeEach(() => {
    loadTotalsMock.mockResolvedValue({
      hours: 24,
      totals: [
        {
          playerId: 'p1',
          displayName: 'Jane',
          icon: '🐎',
          netPoints: 12,
          games: 2,
        },
      ],
    })
    isFloatingForMock.mockReturnValue(false)
  })

  afterEach(() => {
    cleanup()
    enableFloatMock.mockReset()
    isFloatingForMock.mockReset()
    loadTotalsMock.mockReset()
  })

  it('pins the current player and window when Float is pressed', async () => {
    render(
      <SessionPointTrackerModal
        clubId="ABC123"
        clubName="Test Club"
        players={players as never}
        linkedPlayerId="p1"
        onClose={vi.fn()}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Float' }))

    expect(enableFloatMock).toHaveBeenCalledWith({
      clubId: 'ABC123',
      clubName: 'Test Club',
      playerId: 'p1',
      playerName: 'Jane',
      playerIcon: '🐎',
      hours: 24,
    })
  })
})
