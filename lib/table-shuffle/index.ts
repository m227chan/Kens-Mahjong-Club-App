export { analyzeEligibleTables } from './eligible'
export {
  applyGroupsToTables,
  chunkIntoTables,
  defaultRandom,
  pairCost,
  pairKey,
  shuffleArray,
  snakeDraftTables,
} from './assign'
export { buildAbsNetByPair, buildCoPlayByPair } from './pairwise'
export { greedyMinCostTables } from './cluster'
export {
  DEFAULT_SHUFFLE_MODE,
  DEFAULT_SKILL_RATING,
  SHUFFLE_MODES,
  SHUFFLE_MODE_META,
  type ShuffleInput,
  type ShuffleMetrics,
  type ShuffleMode,
  type ShuffleModeMeta,
  type ShuffleResult,
} from './types'

import {
  applyGroupsToTables,
  chunkIntoTables,
  defaultRandom,
  shuffleArray,
  snakeDraftTables,
} from './assign'
import { greedyMinCostTables } from './cluster'
import { analyzeEligibleTables } from './eligible'
import {
  DEFAULT_SKILL_RATING,
  type ShuffleInput,
  type ShuffleMetrics,
  type ShuffleResult,
} from './types'

function emptyMetrics(): ShuffleMetrics {
  return {
    sessionNetByPlayer: {},
    skillByPlayer: {},
    pointsByPlayer: {},
    absNetByPair: {},
    coPlayByPair: {},
  }
}

function mergeMetrics(partial?: Partial<ShuffleMetrics>): ShuffleMetrics {
  return { ...emptyMetrics(), ...partial }
}

function sortByMetricDesc(
  pool: string[],
  values: Record<string, number>,
  fallback: number,
): string[] {
  return [...pool].sort((left, right) => {
    const leftValue = values[left] ?? fallback
    const rightValue = values[right] ?? fallback
    if (rightValue !== leftValue) return rightValue - leftValue
    return left.localeCompare(right)
  })
}

function buildGroups(
  input: ShuffleInput,
  pool: string[],
  tableCount: number,
  metrics: ShuffleMetrics,
  random: () => number,
): string[][] {
  switch (input.mode) {
    case 'fullRandom':
      return chunkIntoTables(shuffleArray(pool, random), tableCount)
    case 'sharkRedemption':
      return chunkIntoTables(
        sortByMetricDesc(pool, metrics.sessionNetByPlayer, 0),
        tableCount,
      )
    case 'nemesis':
      // Unplayed pairs are not rivals — treat missing differentials as expensive.
      return greedyMinCostTables(
        pool,
        tableCount,
        metrics.absNetByPair,
        random,
        1_000_000,
      )
    case 'neverMet':
      return greedyMinCostTables(pool, tableCount, metrics.coPlayByPair, random)
    case 'skillBalance':
      return snakeDraftTables(
        sortByMetricDesc(pool, metrics.skillByPlayer, DEFAULT_SKILL_RATING),
        tableCount,
      )
    case 'standingsBalance':
      return snakeDraftTables(
        sortByMetricDesc(pool, metrics.pointsByPlayer, 0),
        tableCount,
      )
    default: {
      const _exhaustive: never = input.mode
      return _exhaustive
    }
  }
}

/**
 * Remap players on complete tables of 4 according to `mode`.
 * Partial tables and any seats outside the eligible pool are preserved.
 */
export function shuffleTables(input: ShuffleInput): ShuffleResult {
  const random = input.random ?? defaultRandom
  const { touchedTableIds, skippedTableIds, pool } = analyzeEligibleTables(
    input.tables,
  )

  if (touchedTableIds.length === 0) {
    return {
      tables: { ...input.tables },
      touchedTableIds,
      skippedTableIds,
      poolSize: 0,
    }
  }

  const metrics = mergeMetrics(input.metrics)
  const groups = buildGroups(
    input,
    pool,
    touchedTableIds.length,
    metrics,
    random,
  )

  return {
    tables: applyGroupsToTables(
      input.tables,
      touchedTableIds,
      groups,
      random,
    ),
    touchedTableIds,
    skippedTableIds,
    poolSize: pool.length,
  }
}
