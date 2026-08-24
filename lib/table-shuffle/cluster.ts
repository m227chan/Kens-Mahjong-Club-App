import { defaultRandom, pairCost } from './assign'

/**
 * Repeatedly build tables of 4 that minimize total pairwise cost
 * (Nemesis = |net|, Never Met = co-play count).
 */
export function greedyMinCostTables(
  pool: string[],
  tableCount: number,
  costs: Record<string, number>,
  random: () => number = defaultRandom,
  defaultCost = 0,
): string[][] {
  const remaining = [...pool]
  const groups: string[][] = []

  while (groups.length < tableCount && remaining.length >= 4) {
    let bestPair: [string, string] | null = null
    let bestPairCost = Number.POSITIVE_INFINITY

    for (let i = 0; i < remaining.length; i += 1) {
      for (let j = i + 1; j < remaining.length; j += 1) {
        const a = remaining[i]!
        const b = remaining[j]!
        const cost = pairCost(a, b, costs, defaultCost)
        if (
          cost < bestPairCost ||
          (cost === bestPairCost && random() < 0.5)
        ) {
          bestPairCost = cost
          bestPair = [a, b]
        }
      }
    }

    if (!bestPair) break

    const group = [...bestPair]
    remaining.splice(remaining.indexOf(bestPair[0]), 1)
    remaining.splice(remaining.indexOf(bestPair[1]), 1)

    while (group.length < 4) {
      let bestPlayer: string | null = null
      let bestAddCost = Number.POSITIVE_INFINITY
      for (const candidate of remaining) {
        const addCost = group.reduce(
          (sum, member) => sum + pairCost(member, candidate, costs, defaultCost),
          0,
        )
        if (
          addCost < bestAddCost ||
          (addCost === bestAddCost && random() < 0.5)
        ) {
          bestAddCost = addCost
          bestPlayer = candidate
        }
      }
      if (!bestPlayer) break
      group.push(bestPlayer)
      remaining.splice(remaining.indexOf(bestPlayer), 1)
    }

    groups.push(group)
  }

  return groups
}
