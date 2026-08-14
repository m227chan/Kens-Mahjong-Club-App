import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Timestamp } from '@/lib/timestamp'
import type { PlayerDoc, PlayerStatsDoc } from '@/lib/types'

const dataMocks = vi.hoisted(() => ({
  loadGamesInDateRange: vi.fn().mockResolvedValue([]),
  subscribePlayerStats: vi.fn(() => vi.fn()),
  subscribePlayers: vi.fn(() => vi.fn()),
}))

vi.mock('@/lib/data', () => dataMocks)

import { LeaderboardPanel } from '@/components/Leaderboard'

const player = {
  id: 'player-1',
  displayName: 'Ada',
  title: '',
  icon: '🀄',
  authUid: null,
  createdAt: Timestamp.now(),
  active: true,
} satisfies PlayerDoc

const stats = {
  playerId: player.id,
  seasonNumber: 2,
  totalPoints: 120,
  gamesPlayed: 3,
  gamesWon: 2,
  gamesLost: 1,
  winLossRatio: 2,
  bestSingleGame: 80,
  worstSingleGame: -20,
  eloRating: 1500,
  eloPeak: 1510,
  eloRank: 1,
  pointsRank: 1,
  last5EloDelta: 10,
  skillMu: 25,
  skillSigma: 8,
  skillRating: 1510,
  skillPeak: 1510,
  skillGamesPlayed: 3,
  skillRank: 1,
  last5SkillDelta: 10,
  recentPointTrend: [20, 70, 120],
  daysAttended: 1,
  lastPlayedAt: new Date().toISOString().slice(0, 10),
  updatedAt: Timestamp.now(),
} satisfies PlayerStatsDoc

describe('leaderboard history queries', () => {
  beforeEach(() => dataMocks.loadGamesInDateRange.mockClear())

  it('uses persisted trends by default and loads history only for a date filter', async () => {
    render(
      <LeaderboardPanel
        clubId="CLUB1"
        seasonNumber={2}
        players={[player]}
        stats={[stats]}
      />,
    )

    await waitFor(() =>
      expect(dataMocks.loadGamesInDateRange).not.toHaveBeenCalled(),
    )
    fireEvent.click(
      screen.getByRole('button', { name: /filter leaderboard/i }),
    )
    fireEvent.change(screen.getByLabelText('Date range'), {
      target: { value: '30d' },
    })
    await waitFor(() =>
      expect(dataMocks.loadGamesInDateRange).toHaveBeenCalledTimes(1),
    )
  })
})
