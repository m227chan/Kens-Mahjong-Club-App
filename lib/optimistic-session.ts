import { seatReplacementOrder } from '@/lib/table-winds'

export type OptimisticSessionLayout = {
  tableCount: number
  participants: string[]
  tables: Record<string, string[]>
  sideline: string[]
  tableWinds?: Record<string, { seatOrder: string[] }>
}

const cloneTables = (tables: Record<string, string[]>) =>
  Object.fromEntries(Object.entries(tables).map(([tableId, players]) => [tableId, [...players]]))

export function optimisticallySeatPlayer<T extends OptimisticSessionLayout>(
  session: T,
  tableId: string,
  playerId: string,
): T {
  const tables = cloneTables(session.tables)
  const target = (tables[tableId] ?? []).filter(Boolean)
  if (!target.includes(playerId) && target.length >= 4) return session

  for (const id of Object.keys(tables)) tables[id] = tables[id].filter((candidate) => candidate !== playerId)
  tables[tableId] = seatReplacementOrder(
    session.tableWinds?.[tableId]?.seatOrder,
    tables[tableId] ?? [],
    playerId,
  )

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

export function optimisticallySwapPlayers<T extends OptimisticSessionLayout>(
  session: T,
  tableId: string,
  playerId: string,
  otherPlayerId: string,
): T {
  if (!playerId || !otherPlayerId || playerId === otherPlayerId) return session
  const tables = cloneTables(session.tables)
  const seats = [...(tables[tableId] ?? [])]
  const firstIndex = seats.indexOf(playerId)
  const secondIndex = seats.indexOf(otherPlayerId)
  if (firstIndex < 0 || secondIndex < 0) return session
  seats[firstIndex] = otherPlayerId
  seats[secondIndex] = playerId
  tables[tableId] = seats
  return { ...session, tables }
}

/** Put `incomingId` in `outgoingId`'s chair instead of appending after a remove. */
export function replacePlayerAtSeat(
  seats: string[],
  outgoingId: string,
  incomingId: string,
): string[] {
  if (!outgoingId || !incomingId) return seats.filter(Boolean).slice(0, 4)
  if (outgoingId === incomingId) return seats.filter(Boolean).slice(0, 4)
  const outgoingIndex = seats.indexOf(outgoingId)
  if (outgoingIndex < 0) {
    const next = seats.filter((id) => id && id !== incomingId)
    return [...next, incomingId].slice(0, 4)
  }
  const cleaned = seats.filter((id) => id !== outgoingId && id !== incomingId)
  cleaned.splice(Math.min(outgoingIndex, cleaned.length), 0, incomingId)
  return cleaned.slice(0, 4)
}


export function optimisticallyClearAllTables<T extends OptimisticSessionLayout>(session: T): T {
  const tables = cloneTables(session.tables)
  const removed = Object.values(tables).flat()
  for (const tableId of Object.keys(tables)) tables[tableId] = []
  return { ...session, tables, sideline: [...new Set([...session.sideline, ...removed])] }
}
