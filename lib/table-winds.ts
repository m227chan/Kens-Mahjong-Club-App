import type { Wind } from '@/lib/hand-scoring/types'
import type { WindRotationMode } from '@/lib/wind-rotation-settings'

export type TableWindState = {
  roundWind: Wind
  dealerPlayerId: string
  roundStarterPlayerId: string
  handNumber: number
  seatOrder: string[]
}

export type TableWindsMap = Record<string, TableWindState>

export type WindOutcome = 'self_draw' | 'discard' | 'draw'

export const WINDS: Wind[] = ['east', 'south', 'west', 'north']

export const WIND_LABELS: Record<Wind, string> = {
  east: 'East',
  south: 'South',
  west: 'West',
  north: 'North',
}

export const WIND_CHARS: Record<Wind, string> = {
  east: '東',
  south: '南',
  west: '西',
  north: '北',
}

export const WIND_PHONETICS: Record<Wind, string> = {
  east: 'dong',
  south: 'nan',
  west: 'xi',
  north: 'bei',
}

/** Compass layout: East bottom, South right, West top, North left. */
export const COMPASS_POSITIONS: Record<
  Wind,
  'bottom' | 'right' | 'top' | 'left'
> = {
  east: 'bottom',
  south: 'right',
  west: 'top',
  north: 'left',
}

function nextWind(wind: Wind): Wind {
  return WINDS[(WINDS.indexOf(wind) + 1) % WINDS.length]!
}

export function isTableWindState(value: unknown): value is TableWindState {
  if (!value || typeof value !== 'object') return false
  const state = value as Partial<TableWindState>
  if (!WINDS.includes(state.roundWind as Wind)) return false
  if (typeof state.dealerPlayerId !== 'string' || !state.dealerPlayerId)
    return false
  if (
    typeof state.roundStarterPlayerId !== 'string' ||
    !state.roundStarterPlayerId
  )
    return false
  if (
    !Number.isInteger(state.handNumber) ||
    (state.handNumber as number) < 1
  )
    return false
  if (
    !Array.isArray(state.seatOrder) ||
    state.seatOrder.length !== 4 ||
    !state.seatOrder.every((id) => typeof id === 'string' && id)
  )
    return false
  if (!state.seatOrder.includes(state.dealerPlayerId)) return false
  if (!state.seatOrder.includes(state.roundStarterPlayerId)) return false
  return true
}

export function parseTableWindsMap(value: unknown): TableWindsMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: TableWindsMap = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (isTableWindState(entry)) result[key] = entry
  }
  return result
}

export function initTableWinds(
  starterPlayerId: string,
  seatOrder: string[],
): TableWindState {
  const order = seatOrder.filter(Boolean).slice(0, 4)
  if (order.length !== 4) {
    throw new Error('Table winds require four seated players.')
  }
  if (!order.includes(starterPlayerId)) {
    throw new Error('Starter must be seated at the table.')
  }
  return {
    roundWind: 'east',
    dealerPlayerId: starterPlayerId,
    roundStarterPlayerId: starterPlayerId,
    handNumber: 1,
    seatOrder: [...order],
  }
}

/** Seat winds relative to current dealer, using live seat order when provided. */
export function seatWindsForOrder(
  dealerPlayerId: string,
  seatOrder: string[],
): Record<string, Wind> {
  const order = seatOrder.filter(Boolean).slice(0, 4)
  if (order.length !== 4) return {}
  let dealerIndex = order.indexOf(dealerPlayerId)
  // Dealer left the table (e.g. dashboard move) — keep a stable compass until winds reconcile.
  if (dealerIndex < 0) dealerIndex = 0
  const map: Record<string, Wind> = {}
  for (let offset = 0; offset < 4; offset++) {
    const playerId = order[(dealerIndex + offset) % 4]!
    map[playerId] = WINDS[offset]!
  }
  return map
}

export function seatWindForPlayer(
  state: TableWindState,
  playerId: string,
  liveSeatOrder?: string[],
): Wind | null {
  const order =
    liveSeatOrder && liveSeatOrder.filter(Boolean).length === 4
      ? liveSeatOrder.filter(Boolean).slice(0, 4)
      : state.seatOrder
  return seatWindsForOrder(state.dealerPlayerId, order)[playerId] ?? null
}

export function shouldRotateWinds(input: {
  mode: WindRotationMode
  outcome: WindOutcome
  winnerPlayerId: string | null
  dealerPlayerId: string
}): boolean {
  const { mode, outcome, winnerPlayerId, dealerPlayerId } = input
  if (mode === 'always') return true
  const dealerWon =
    outcome !== 'draw' &&
    Boolean(winnerPlayerId) &&
    winnerPlayerId === dealerPlayerId
  if (mode === 'non_dealer_only') {
    return outcome !== 'draw' && !dealerWon
  }
  // non_dealer_and_draw: rotate on draw or non-dealer win
  if (outcome === 'draw') return true
  return !dealerWon
}

export function nextWindState(input: {
  mode: WindRotationMode
  outcome: WindOutcome
  winnerPlayerId: string | null
  state: TableWindState
  liveSeatOrder?: string[]
}): { state: TableWindState; rotated: boolean; advancedRound: boolean } {
  const order =
    input.liveSeatOrder && input.liveSeatOrder.filter(Boolean).length === 4
      ? input.liveSeatOrder.filter(Boolean).slice(0, 4)
      : input.state.seatOrder

  const base: TableWindState = {
    ...input.state,
    seatOrder: [...order],
  }

  const rotate = shouldRotateWinds({
    mode: input.mode,
    outcome: input.outcome,
    winnerPlayerId: input.winnerPlayerId,
    dealerPlayerId: base.dealerPlayerId,
  })

  if (!rotate) {
    return {
      state: { ...base, handNumber: base.handNumber + 1 },
      rotated: false,
      advancedRound: false,
    }
  }

  const dealerIndex = order.indexOf(base.dealerPlayerId)
  if (dealerIndex < 0) {
    return {
      state: { ...base, handNumber: base.handNumber + 1 },
      rotated: false,
      advancedRound: false,
    }
  }

  const nextDealer = order[(dealerIndex + 1) % 4]!
  let roundWind = base.roundWind
  let roundStarterPlayerId = base.roundStarterPlayerId
  let advancedRound = false

  if (nextDealer === base.roundStarterPlayerId) {
    roundWind = nextWind(base.roundWind)
    roundStarterPlayerId = nextDealer
    advancedRound = true
  }

  return {
    state: {
      roundWind,
      dealerPlayerId: nextDealer,
      roundStarterPlayerId,
      handNumber: base.handNumber + 1,
      seatOrder: [...order],
    },
    rotated: true,
    advancedRound,
  }
}

/**
 * After a seat change: keep the current round/hand when possible.
 * - Empty table: clear winds
 * - Table not full: pause (preserve state) so a swap can continue later
 * - One-for-one swap: new player inherits the departed player's wind roles
 * - Dealer still seated: update seat order only
 * - Dealer gone without a clean swap: keep round/hand and assign dealer to a joiner
 */
export function continueWindsAfterRosterChange(
  state: TableWindState | undefined,
  liveSeatOrder: string[],
): TableWindState | null {
  if (!state) return null
  const order = liveSeatOrder.filter(Boolean).slice(0, 4)

  // Cleared table — drop winds.
  if (order.length === 0) return null

  // Incomplete table — pause winds so a swap can resume the same hand/round.
  if (order.length !== 4) return state

  const previous = state.seatOrder.filter(Boolean)
  const left = previous.filter((id) => !order.includes(id))
  const joined = order.filter((id) => !previous.includes(id))

  if (left.length === 1 && joined.length === 1) {
    const from = left[0]!
    const to = joined[0]!
    const mapId = (id: string) => (id === from ? to : id)
    return {
      ...state,
      dealerPlayerId: mapId(state.dealerPlayerId),
      roundStarterPlayerId: mapId(state.roundStarterPlayerId),
      seatOrder: [...order],
    }
  }

  if (order.includes(state.dealerPlayerId)) {
    const roundStarter = order.includes(state.roundStarterPlayerId)
      ? state.roundStarterPlayerId
      : state.dealerPlayerId
    return {
      ...state,
      roundStarterPlayerId: roundStarter,
      seatOrder: [...order],
    }
  }

  // No shared players — treat as a fresh table.
  const overlap = order.filter((id) => previous.includes(id))
  if (overlap.length === 0) return null

  if (joined.length > 0) {
    const newDealer = joined[0]!
    return {
      ...state,
      dealerPlayerId: newDealer,
      roundStarterPlayerId: order.includes(state.roundStarterPlayerId)
        ? state.roundStarterPlayerId
        : newDealer,
      seatOrder: [...order],
    }
  }

  return null
}

/** Recompute every table's wind state after a dashboard / session layout change. */
export function reconcileTableWindsMap(
  map: TableWindsMap | undefined,
  tables: Record<string, string[]>,
): TableWindsMap {
  const next: TableWindsMap = {}
  const keys = new Set([
    ...Object.keys(map ?? {}),
    ...Object.keys(tables),
  ])
  for (const key of keys) {
    const continued = continueWindsAfterRosterChange(
      map?.[key],
      tables[key] ?? [],
    )
    if (continued) next[key] = continued
  }
  return next
}

export type TableWindPatch = {
  roundWind?: Wind
  dealerPlayerId?: string
  handNumber?: number
}

/** Manual correction of prevailing wind / dealer without restarting the table. */
export function applyTableWindPatch(
  state: TableWindState,
  patch: TableWindPatch,
  liveSeatOrder?: string[],
): TableWindState {
  const order =
    liveSeatOrder && liveSeatOrder.filter(Boolean).length === 4
      ? liveSeatOrder.filter(Boolean).slice(0, 4)
      : state.seatOrder

  const next: TableWindState = {
    ...state,
    seatOrder: [...order],
  }

  if (patch.roundWind != null) {
    if (!WINDS.includes(patch.roundWind)) {
      throw new Error('Choose a valid table wind.')
    }
    next.roundWind = patch.roundWind
  }

  if (patch.dealerPlayerId != null) {
    if (!order.includes(patch.dealerPlayerId)) {
      throw new Error('Dealer must be seated at this table.')
    }
    next.dealerPlayerId = patch.dealerPlayerId
  }

  if (patch.handNumber != null) {
    if (!Number.isInteger(patch.handNumber) || patch.handNumber < 1) {
      throw new Error('Hand number must be a positive whole number.')
    }
    next.handNumber = patch.handNumber
  }

  if (!order.includes(next.roundStarterPlayerId)) {
    next.roundStarterPlayerId = next.dealerPlayerId
  }

  return next
}

export function clearTableWind(
  map: TableWindsMap,
  tableId: string,
): TableWindsMap {
  const next = { ...map }
  delete next[tableId]
  return next
}

export function upsertTableWind(
  map: TableWindsMap,
  tableId: string,
  state: TableWindState | null,
): TableWindsMap {
  const next = { ...map }
  if (!state) {
    delete next[tableId]
    return next
  }
  next[tableId] = state
  return next
}
