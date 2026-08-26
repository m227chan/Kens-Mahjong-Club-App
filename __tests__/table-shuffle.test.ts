import { describe, expect, it } from 'vitest'
import { Timestamp } from '@/lib/timestamp'
import type { GameDoc } from '@/lib/types'
import {
  analyzeEligibleTables,
  buildAbsNetByPair,
  buildCoPlayByPair,
  pairKey,
  shuffleTables,
  snakeDraftTables,
} from '@/lib/table-shuffle'

function fixedRandom(sequence: number[]) {
  let index = 0
  return () => {
    const value = sequence[index % sequence.length] ?? 0
    index += 1
    return value
  }
}

/** Deterministic RNG that always swaps with index 0 — keeps seat order stable enough for asserts. */
function noShuffleRandom() {
  return 0
}

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

describe('analyzeEligibleTables', () => {
  it('collects only complete tables of 4', () => {
    const result = analyzeEligibleTables({
      '1': ['a', 'b', 'c', 'd'],
      '2': ['e', 'f'],
      '3': ['g', 'h', 'i', 'j'],
      '4': [],
    })

    expect(result.touchedTableIds).toEqual(['1', '3'])
    expect(result.skippedTableIds).toEqual(['2', '4'])
    expect(result.pool).toEqual(['a', 'b', 'c', 'd', 'g', 'h', 'i', 'j'])
  })
})

describe('shuffleTables', () => {
  const baseTables = {
    '1': ['a', 'b', 'c', 'd'],
    '2': ['e', 'f'],
    '3': ['g', 'h', 'i', 'j'],
  }

  it('preserves partial tables and the pool membership for full random', () => {
    const result = shuffleTables({
      tables: baseTables,
      mode: 'fullRandom',
      random: fixedRandom([0.9, 0.1, 0.5, 0.2, 0.8, 0.3, 0.7, 0.4]),
    })

    expect(result.touchedTableIds).toEqual(['1', '3'])
    expect(result.skippedTableIds).toEqual(['2'])
    expect(result.tables['2']).toEqual(['e', 'f'])
    expect(result.poolSize).toBe(8)

    const reseated = [...result.tables['1']!, ...result.tables['3']!].sort()
    expect(reseated).toEqual(['a', 'b', 'c', 'd', 'g', 'h', 'i', 'j'].sort())
    expect(result.tables['1']).toHaveLength(4)
    expect(result.tables['3']).toHaveLength(4)
  })

  it('returns unchanged layout when no full tables exist', () => {
    const tables = { '1': ['a', 'b'], '2': ['c'] }
    const result = shuffleTables({ tables, mode: 'fullRandom' })
    expect(result.tables).toEqual(tables)
    expect(result.touchedTableIds).toEqual([])
    expect(result.poolSize).toBe(0)
  })

  it('groups shark redemption by session net descending', () => {
    const result = shuffleTables({
      tables: {
        '1': ['a', 'b', 'c', 'd'],
        '2': ['e', 'f', 'g', 'h'],
      },
      mode: 'sharkRedemption',
      metrics: {
        sessionNetByPlayer: {
          a: 100,
          b: 80,
          c: 60,
          d: 40,
          e: 20,
          f: 0,
          g: -20,
          h: -40,
        },
      },
      random: noShuffleRandom,
    })

    expect(result.tables['1']!.sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(result.tables['2']!.sort()).toEqual(['e', 'f', 'g', 'h'])
  })

  it('snake-drafts skill balance across tables', () => {
    const groups = snakeDraftTables(
      ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'],
      2,
    )
    // Round 0: p1→t0, p2→t1; Round 1 (reverse): p3→t1, p4→t0; ...
    expect(groups[0]).toEqual(['p1', 'p4', 'p5', 'p8'])
    expect(groups[1]).toEqual(['p2', 'p3', 'p6', 'p7'])

    const result = shuffleTables({
      tables: {
        '1': ['p1', 'p2', 'p3', 'p4'],
        '2': ['p5', 'p6', 'p7', 'p8'],
      },
      mode: 'skillBalance',
      metrics: {
        skillByPlayer: {
          p1: 1800,
          p2: 1700,
          p3: 1600,
          p4: 1500,
          p5: 1400,
          p6: 1300,
          p7: 1200,
          p8: 1100,
        },
      },
      random: noShuffleRandom,
    })

    expect(result.tables['1']!.sort()).toEqual(['p1', 'p4', 'p5', 'p8'].sort())
    expect(result.tables['2']!.sort()).toEqual(['p2', 'p3', 'p6', 'p7'].sort())
  })

  it('standings balance snake-drafts by season points', () => {
    const result = shuffleTables({
      tables: {
        '1': ['a', 'b', 'c', 'd'],
        '2': ['e', 'f', 'g', 'h'],
      },
      mode: 'standingsBalance',
      metrics: {
        pointsByPlayer: {
          a: 400,
          b: 350,
          c: 300,
          d: 250,
          e: 200,
          f: 150,
          g: 100,
          h: 50,
        },
      },
      random: noShuffleRandom,
    })

    expect(result.tables['1']!.sort()).toEqual(['a', 'd', 'e', 'h'].sort())
    expect(result.tables['2']!.sort()).toEqual(['b', 'c', 'f', 'g'].sort())
  })

  it('never-met prefers pairs with zero co-play', () => {
    const result = shuffleTables({
      tables: {
        '1': ['a', 'b', 'c', 'd'],
        '2': ['e', 'f', 'g', 'h'],
      },
      mode: 'neverMet',
      metrics: {
        // a-b-c-d have all played together heavily; e-f-g-h never met anyone in the first group
        // and lightly among themselves — greedy should pack the zero-weight strangers.
        coPlayByPair: {
          [pairKey('a', 'b')]: 10,
          [pairKey('a', 'c')]: 10,
          [pairKey('a', 'd')]: 10,
          [pairKey('b', 'c')]: 10,
          [pairKey('b', 'd')]: 10,
          [pairKey('c', 'd')]: 10,
          [pairKey('a', 'e')]: 5,
          [pairKey('b', 'f')]: 5,
          [pairKey('c', 'g')]: 5,
          [pairKey('d', 'h')]: 5,
        },
      },
      random: noShuffleRandom,
    })

    const table1 = new Set(result.tables['1'])
    const table2 = new Set(result.tables['2'])
    const strangers = ['e', 'f', 'g', 'h']
    const together = strangers.filter((id) => table1.has(id)).length
    // At least one table should be dominated by the never-met cluster.
    expect(together === 4 || strangers.every((id) => table2.has(id))).toBe(true)
  })

  it('nemesis prefers pairs with the lowest absolute net differential', () => {
    const result = shuffleTables({
      tables: {
        '1': ['a', 'b', 'c', 'd'],
        '2': ['e', 'f', 'g', 'h'],
      },
      mode: 'nemesis',
      metrics: {
        absNetByPair: {
          [pairKey('a', 'b')]: 1,
          [pairKey('a', 'c')]: 1,
          [pairKey('a', 'd')]: 1,
          [pairKey('b', 'c')]: 1,
          [pairKey('b', 'd')]: 1,
          [pairKey('c', 'd')]: 1,
          [pairKey('e', 'f')]: 100,
          [pairKey('e', 'g')]: 100,
          [pairKey('e', 'h')]: 100,
          [pairKey('f', 'g')]: 100,
          [pairKey('f', 'h')]: 100,
          [pairKey('g', 'h')]: 100,
          [pairKey('a', 'e')]: 50,
          [pairKey('b', 'f')]: 50,
          [pairKey('c', 'g')]: 50,
          [pairKey('d', 'h')]: 50,
        },
      },
      random: noShuffleRandom,
    })

    expect(result.tables['1']!.sort()).toEqual(['a', 'b', 'c', 'd'])
    expect(result.tables['2']!.sort()).toEqual(['e', 'f', 'g', 'h'])
  })
})

describe('pairwise builders', () => {
  it('counts co-play edges from shared games', () => {
    const games = [
      game({
        id: 'g1',
        entries: [
          { playerId: 'a', score: 1 },
          { playerId: 'b', score: -1 },
          { playerId: 'c', score: 0 },
          { playerId: 'd', score: 0 },
        ],
      }),
      game({
        id: 'g2',
        entries: [
          { playerId: 'a', score: 1 },
          { playerId: 'b', score: -1 },
          { playerId: 'e', score: 0 },
          { playerId: 'f', score: 0 },
        ],
      }),
    ]

    const counts = buildCoPlayByPair(games, ['a', 'b', 'c', 'd', 'e'])
    expect(counts[pairKey('a', 'b')]).toBe(2)
    expect(counts[pairKey('a', 'c')]).toBe(1)
    expect(counts[pairKey('a', 'e')]).toBe(1)
    expect(counts[pairKey('c', 'e')]).toBeUndefined()
  })

  it('builds absolute net differentials from game history', () => {
    const games = [
      game({
        id: 'g1',
        winType: 'discard',
        winnerPlayerId: 'a',
        loserPlayerId: 'b',
        entries: [
          { playerId: 'a', score: 32 },
          { playerId: 'b', score: -32 },
          { playerId: 'c', score: 0 },
          { playerId: 'd', score: 0 },
        ],
      }),
    ]

    const absNet = buildAbsNetByPair(games, ['a', 'b', 'c', 'd'])
    expect(absNet[pairKey('a', 'b')]).toBe(32)
  })
})
