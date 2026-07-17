import type { NetworkGraphData, NetworkEdge, NetworkEvent } from './types'

/**
 * Builds one edge per pair of entities that ever co-occurred in an event,
 * weighted by how many events they shared.
 */
export function computeNetworkEdges(data: NetworkGraphData): NetworkEdge[] {
  const pairCounts = new Map<string, number>()

  data.events.forEach((event) => {
    const present = event.participants
    for (let i = 0; i < present.length; i++) {
      for (let j = i + 1; j < present.length; j++) {
        // Sorted join = order-independent key, so (A,B) and (B,A) collapse together.
        const key = [present[i], present[j]].sort().join('::')
        pairCounts.set(key, (pairCounts.get(key) ?? 0) + 1)
      }
    }
  })

  return Array.from(pairCounts.entries()).map(([key, weight]) => {
    const [from, to] = key.split('::')
    return { from: from!, to: to!, weight }
  })
}

export interface FilterOptions {
  /** Drop edges below this weight. Default 1 (keep everything). */
  minWeight?: number
  /** If set, keep only edges touching this one entity ("ego graph" mode). */
  egoEntity?: string | null
}

export function filterEdges(edges: NetworkEdge[], options: FilterOptions = {}): NetworkEdge[] {
  const { minWeight = 1, egoEntity } = options
  let filtered = edges.filter((e) => e.weight >= minWeight)
  if (egoEntity) {
    filtered = filtered.filter((e) => e.from === egoEntity || e.to === egoEntity)
  }
  return filtered
}

/**
 * Which entities should actually be rendered as nodes, given a filtered
 * edge list. Trims isolated entities unless egoEntity is set.
 */
export function nodesForEdges(
  allEntities: string[],
  edges: NetworkEdge[],
  egoEntity?: string | null
): string[] {
  const connected = new Set<string>()
  edges.forEach((e) => {
    connected.add(e.from)
    connected.add(e.to)
  })
  if (egoEntity) connected.add(egoEntity)
  return allEntities.filter((n) => connected.has(n))
}

/**
 * Bridge helper for wide-table source data (one row per event, one column
 * per entity, null/undefined meaning "didn't participate").
 */
export function fromWideTable(
  rows: { id: string; timestamp?: string; valuesByEntity: Record<string, unknown> }[]
): NetworkEvent[] {
  return rows.map((row) => ({
    id: row.id,
    timestamp: row.timestamp,
    participants: Object.entries(row.valuesByEntity)
      .filter(([, v]) => v !== null && v !== undefined)
      .map(([entity]) => entity),
  }))
}
