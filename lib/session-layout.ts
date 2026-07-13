export function createInitialSessionLayout(participants: string[], tableCount: number) {
  return {
    tables: Object.fromEntries(Array.from({ length: tableCount }, (_, index) => [String(index + 1), [] as string[]])),
    sideline: [...participants]
  }
}

export function normalizeSessionLayout(
  participants: string[],
  tableCount: number,
  rawTables: Record<string, string[]> = {},
  rawSideline: string[] = []
) {
  const legacyAutoSeated = Object.keys(rawTables).some((key) => /^table_\d+$/.test(key))
  const tables = Object.fromEntries(
    Array.from({ length: tableCount }, (_, index) => {
      const tableId = String(index + 1)
      return [tableId, legacyAutoSeated ? [] : (rawTables[tableId] ?? [])]
    })
  )
  const assigned = new Set(Object.values(tables).flat())
  const storedSideline = legacyAutoSeated ? participants : rawSideline
  const sideline = [...new Set([...storedSideline, ...participants].filter((playerId) => !assigned.has(playerId)))]
  return { tables, sideline }
}
