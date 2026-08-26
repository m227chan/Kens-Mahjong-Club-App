export type EligibleLayout = {
  touchedTableIds: string[]
  skippedTableIds: string[]
  pool: string[]
}

/** Full tables are exactly 4 seated players; everything else is left alone. */
export function analyzeEligibleTables(
  tables: Record<string, string[]>,
): EligibleLayout {
  const touchedTableIds: string[] = []
  const skippedTableIds: string[] = []
  const pool: string[] = []

  const ids = Object.keys(tables).sort((a, b) => Number(a) - Number(b) || a.localeCompare(b))
  for (const tableId of ids) {
    const seats = tables[tableId] ?? []
    if (seats.length === 4) {
      touchedTableIds.push(tableId)
      pool.push(...seats)
    } else {
      skippedTableIds.push(tableId)
    }
  }

  return { touchedTableIds, skippedTableIds, pool }
}
