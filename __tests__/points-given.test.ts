import { describe, expect, it } from 'vitest'
import { computeNetPointsWithEgo } from '@/components/network/pointsGiven'
import { Timestamp } from '@/lib/timestamp'
import type { GameDoc } from '@/lib/types'

function game(partial: Partial<GameDoc> & Pick<GameDoc, 'id' | 'entries'>): GameDoc {
  return {
    datetime: Timestamp.fromMillis(Date.now()),
    createdBy: 'test',
    seasonNumber: 1,
    tableId: null,
    winType: 'self_draw',
    winnerPlayerId: null,
    loserPlayerId: null,
    fan: null,
    notes: null,
    ...partial,
  }
}

describe('computeNetPointsWithEgo', () => {
  it('attributes full discard win to the discarder as positive net', () => {
    const games = [
      game({
        id: 'g1',
        winType: 'discard',
        winnerPlayerId: 'alice',
        loserPlayerId: 'bob',
        entries: [
          { playerId: 'alice', score: 32 },
          { playerId: 'bob', score: -32 },
          { playerId: 'carol', score: 0 },
          { playerId: 'dave', score: 0 },
        ],
      }),
    ]

    expect(computeNetPointsWithEgo(games, 'alice')).toEqual({ bob: 32 })
  })

  it('splits self-draw wins across losers as positive net', () => {
    const games = [
      game({
        id: 'g2',
        winType: 'self_draw',
        winnerPlayerId: 'alice',
        entries: [
          { playerId: 'alice', score: 48 },
          { playerId: 'bob', score: -16 },
          { playerId: 'carol', score: -16 },
          { playerId: 'dave', score: -16 },
        ],
      }),
    ]

    expect(computeNetPointsWithEgo(games, 'alice')).toEqual({
      bob: 16,
      carol: 16,
      dave: 16,
    })
  })

  it('attributes losses as negative net toward the winner', () => {
    const games = [
      game({
        id: 'g3',
        winType: 'self_draw',
        winnerPlayerId: 'bob',
        entries: [
          { playerId: 'alice', score: -16 },
          { playerId: 'bob', score: 48 },
          { playerId: 'carol', score: -16 },
          { playerId: 'dave', score: -16 },
        ],
      }),
    ]

    expect(computeNetPointsWithEgo(games, 'alice')).toEqual({ bob: -16 })
  })

  it('nets wins and losses across multiple games', () => {
    const games = [
      game({
        id: 'win',
        winType: 'discard',
        winnerPlayerId: 'alice',
        loserPlayerId: 'bob',
        entries: [
          { playerId: 'alice', score: 32 },
          { playerId: 'bob', score: -32 },
          { playerId: 'carol', score: 0 },
          { playerId: 'dave', score: 0 },
        ],
      }),
      game({
        id: 'loss',
        winType: 'discard',
        winnerPlayerId: 'bob',
        loserPlayerId: 'alice',
        entries: [
          { playerId: 'alice', score: -16 },
          { playerId: 'bob', score: 16 },
          { playerId: 'carol', score: 0 },
          { playerId: 'dave', score: 0 },
        ],
      }),
    ]

    expect(computeNetPointsWithEgo(games, 'alice')).toEqual({ bob: 16 })
  })
})
