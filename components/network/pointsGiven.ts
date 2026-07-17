import type { GameDoc } from '@/lib/types'

/**
 * Net point flow between ego and each opponent across the given games.
 *
 * Positive  = opponent paid ego (ego gained from them)
 * Negative  = ego paid opponent (ego lost to them)
 *
 * Attribution is proportional within each zero-sum game:
 * - Ego wins: each loser's share of ego's gain
 * - Ego loses: each winner's share of ego's loss
 */
export function computeNetPointsWithEgo(games: GameDoc[], egoPlayerId: string): Record<string, number> {
  const totals: Record<string, number> = {}

  const add = (playerId: string, amount: number) => {
    totals[playerId] = (totals[playerId] ?? 0) + amount
  }

  for (const game of games) {
    const egoEntry = game.entries.find((entry) => entry.playerId === egoPlayerId)
    if (!egoEntry || egoEntry.score === 0) continue

    if (egoEntry.score > 0) {
      const losers = game.entries.filter((entry) => entry.playerId !== egoPlayerId && entry.score < 0)
      const totalLosses = losers.reduce((sum, entry) => sum + -entry.score, 0)
      if (totalLosses <= 0) continue
      for (const loser of losers) {
        add(loser.playerId, egoEntry.score * (-loser.score / totalLosses))
      }
      continue
    }

    // Ego lost points — attribute that loss to each player who scored positive.
    const winners = game.entries.filter((entry) => entry.playerId !== egoPlayerId && entry.score > 0)
    const totalGains = winners.reduce((sum, entry) => sum + entry.score, 0)
    if (totalGains <= 0) continue
    for (const winner of winners) {
      add(winner.playerId, egoEntry.score * (winner.score / totalGains))
    }
  }

  return totals
}

/** Interpolate between two `rgb(r, g, b)` strings by t in [0, 1]. */
export function mixRgb(from: string, to: string, t: number): string {
  const parse = (value: string) => {
    const match = value.match(/rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/)
    if (!match) return [0, 0, 0] as const
    return [Number(match[1]), Number(match[2]), Number(match[3])] as const
  }
  const clamped = Math.min(1, Math.max(0, t))
  const [r1, g1, b1] = parse(from)
  const [r2, g2, b2] = parse(to)
  const r = Math.round(r1 + (r2 - r1) * clamped)
  const g = Math.round(g1 + (g2 - g1) * clamped)
  const b = Math.round(b1 + (b2 - b1) * clamped)
  return `rgb(${r}, ${g}, ${b})`
}
