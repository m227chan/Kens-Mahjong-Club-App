export function defaultRandom() {
  return Math.random()
}

/** Fisher–Yates shuffle; mutates a copy. */
export function shuffleArray<T>(items: T[], random: () => number = defaultRandom): T[] {
  const next = [...items]
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    const temp = next[index]!
    next[index] = next[swapIndex]!
    next[swapIndex] = temp
  }
  return next
}

export function chunkIntoTables(pool: string[], tableCount: number): string[][] {
  if (tableCount <= 0) return []
  const groups: string[][] = Array.from({ length: tableCount }, () => [])
  pool.forEach((playerId, index) => {
    groups[Math.floor(index / 4)]?.push(playerId)
  })
  return groups.filter((group) => group.length === 4).slice(0, tableCount)
}

/**
 * Snake-draft across `tableCount` tables so high/low metrics stay balanced.
 * `sortedDesc` should already be ordered strongest → weakest.
 */
export function snakeDraftTables(sortedDesc: string[], tableCount: number): string[][] {
  const tables: string[][] = Array.from({ length: tableCount }, () => [])
  sortedDesc.forEach((playerId, index) => {
    const round = Math.floor(index / tableCount)
    const position = index % tableCount
    const tableIndex = round % 2 === 0 ? position : tableCount - 1 - position
    tables[tableIndex]!.push(playerId)
  })
  return tables
}

/** Write grouped seats back onto the original full-table ids; leave others untouched. */
export function applyGroupsToTables(
  tables: Record<string, string[]>,
  touchedTableIds: string[],
  groups: string[][],
  random: () => number = defaultRandom,
): Record<string, string[]> {
  const next: Record<string, string[]> = { ...tables }
  touchedTableIds.forEach((tableId, index) => {
    const group = groups[index] ?? []
    next[tableId] = shuffleArray(group, random)
  })
  return next
}

export function pairKey(a: string, b: string) {
  return a < b ? `${a}::${b}` : `${b}::${a}`
}

export function pairCost(
  a: string,
  b: string,
  costs: Record<string, number>,
  defaultCost = 0,
): number {
  const key = pairKey(a, b)
  return Object.prototype.hasOwnProperty.call(costs, key)
    ? costs[key]!
    : defaultCost
}
