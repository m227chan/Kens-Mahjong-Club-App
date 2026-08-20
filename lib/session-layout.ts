export const MIN_SESSION_TABLES = 1
export const MAX_SESSION_TABLES = 99

export function clampSessionTableCount(tableCount: number) {
  return Math.min(
    MAX_SESSION_TABLES,
    Math.max(MIN_SESSION_TABLES, Math.floor(Number(tableCount) || MIN_SESSION_TABLES)),
  )
}

export function createInitialSessionLayout(
  participants: string[],
  tableCount: number,
) {
  const normalizedTableCount = clampSessionTableCount(tableCount)
  return {
    tables: Object.fromEntries(
      Array.from({ length: normalizedTableCount }, (_, index) => [
        String(index + 1),
        [] as string[],
      ]),
    ),
    sideline: [...participants],
  }
}

export function normalizeSessionLayout(
  participants: string[],
  tableCount: number,
  rawTables: Record<string, string[]> = {},
  rawSideline: string[] = [],
) {
  const normalizedTableCount = clampSessionTableCount(tableCount)
  const legacyAutoSeated = Object.keys(rawTables).some((key) =>
    /^table_\d+$/.test(key),
  )
  const participantSet = new Set(participants)
  const assigned = new Set<string>()
  const tables = Object.fromEntries(
    Array.from({ length: normalizedTableCount }, (_, index) => {
      const tableId = String(index + 1)
      const rawPlayers =
        legacyAutoSeated || !Array.isArray(rawTables[tableId])
          ? []
          : rawTables[tableId]
      const players = rawPlayers
        .map(String)
        .filter(
          (playerId) => participantSet.has(playerId) && !assigned.has(playerId),
        )
        .slice(0, 4)
      players.forEach((playerId) => assigned.add(playerId))
      return [tableId, players]
    }),
  )
  const storedSideline =
    legacyAutoSeated || !Array.isArray(rawSideline) ? participants : rawSideline
  const sideline = [
    ...new Set(
      [...storedSideline.map(String), ...participants].filter(
        (playerId) => participantSet.has(playerId) && !assigned.has(playerId),
      ),
    ),
  ]
  return { tables, sideline }
}
