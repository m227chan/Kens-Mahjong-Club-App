/**
 * Generic co-occurrence network data model.
 *
 * This is deliberately NOT Mahjong-specific — "players" become "entities"
 * and "games" become "events." Any domain where you want to visualize
 * "which things showed up together how often" fits this shape.
 */

export interface NetworkEvent {
  /** Unique id for this event (a game id, a session id, whatever fits your domain). */
  id: string
  /** Optional — useful if you want to filter/sort by time later. */
  timestamp?: string
  /** The entities present in this event. Order doesn't matter. */
  participants: string[]
}

export interface NetworkGraphData {
  /** Every known entity (not just ones that have co-occurred with anything). */
  entities: string[]
  events: NetworkEvent[]
}

export interface NetworkEdge {
  from: string
  to: string
  /** Number of events these two entities both appeared in. */
  weight: number
}
