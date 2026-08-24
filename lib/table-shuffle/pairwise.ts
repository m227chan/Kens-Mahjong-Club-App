import { computeNetPointsWithEgo } from '@/components/network/pointsGiven'
import type { GameDoc } from '@/lib/types'
import { pairKey } from './assign'

/** Shared-game counts for every pair in `pool`. Missing keys mean never met (0). */
export function buildCoPlayByPair(
  games: GameDoc[],
  pool: string[],
): Record<string, number> {
  const poolSet = new Set(pool)
  const counts: Record<string, number> = {}

  for (const game of games) {
    const present = game.entries
      .map((entry) => entry.playerId)
      .filter((playerId) => poolSet.has(playerId))
    for (let i = 0; i < present.length; i += 1) {
      for (let j = i + 1; j < present.length; j += 1) {
        const key = pairKey(present[i]!, present[j]!)
        counts[key] = (counts[key] ?? 0) + 1
      }
    }
  }

  return counts
}

/**
 * Absolute historical net differential per pair.
 * Uses ego attribution from each side and keeps the larger absolute value.
 */
export function buildAbsNetByPair(
  games: GameDoc[],
  pool: string[],
): Record<string, number> {
  const absNet: Record<string, number> = {}

  for (const ego of pool) {
    const nets = computeNetPointsWithEgo(games, ego)
    for (const other of pool) {
      if (other === ego) continue
      const key = pairKey(ego, other)
      const magnitude = Math.abs(nets[other] ?? 0)
      absNet[key] = Math.max(absNet[key] ?? 0, magnitude)
    }
  }

  return absNet
}
