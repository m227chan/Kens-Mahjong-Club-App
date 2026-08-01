export type OptimisticSessionLayout = {
  tableCount: number
  participants: string[]
  tables: Record<string, string[]>
  sideline: string[]
}

const cloneTables = (tables: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(tables).map(([tableId, players]) => [tableId, [...players]]))

export function optimisticallySeatPlayer<T extends OptimisticSessionLayout>(
  session: T,
  tableId: string,
  playerId: string,
): T {
  const tables = cloneTables(session.tables)
  const target = tables[tableId] ?? []
  if (!target.includes(playerId) && target.length >= 4) return session

  for (const id of Object.keys(tables)) tables[id] = tables[id].filter((candidate) => candidate !== playerId)
  tables[tableId] = [...(tables[tableId] ?? []), playerId].slice(0, 4)

  return {
    ...session,
    participants: session.participants.includes(playerId)
      ? session.participants
      : [...session.participants, playerId],
    tables,
    sideline: session.sideline.filter((candidate) => candidate !== playerId),
  }
}

export function optimisticallyRemovePlayer<T extends OptimisticSessionLayout>(
  session: T,
  tableId: string,
  playerId: string,
): T {
  const tables = cloneTables(session.tables)
  tables[tableId] = (tables[tableId] ?? []).filter((candidate) => candidate !== playerId)
  return {
    ...session,
    tables,
    sideline: session.sideline.includes(playerId) ? session.sideline : [...session.sideline, playerId],
  }
}

export function optimisticallyClearTable<T extends OptimisticSessionLayout>(session: T, tableId: string): T {
  const tables = cloneTables(session.tables)
  const removed = tables[tableId] ?? []
  tables[tableId] = []
  return { ...session, tables, sideline: [...new Set([...session.sideline, ...removed])] }
}

export function optimisticallyClearAllTables<T extends OptimisticSessionLayout>(session: T): T {
  const tables = cloneTables(session.tables)
  const removed = Object.values(tables).flat()
  for (const tableId of Object.keys(tables)) tables[tableId] = []
  return { ...session, tables, sideline: [...new Set([...session.sideline, ...removed])] }
}
