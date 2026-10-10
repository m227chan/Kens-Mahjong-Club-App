import type { Wind } from '@/lib/hand-scoring/types'
import type { WindRotationMode } from '@/lib/wind-rotation-settings'

export type TableWindState = {
  roundWind: Wind
  dealerPlayerId: string
  /** Chair that marks the end of a dealer cycle (0–3). Survives player swaps. */
  roundStarterSeatIndex: number
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

export function clampStarterSeatIndex(value: unknown, fallback = 0): number {
  if (!Number.isInteger(value)) return fallback
  const index = value as number
  if (index < 0 || index > 3) return fallback
  return index
}

/** Player currently sitting in the round-starter chair. */
export function playerAtStarterSeat(
  state: TableWindState,
  liveSeatOrder?: string[],
): string | null {
  const order =
    liveSeatOrder && liveSeatOrder.filter(Boolean).length === 4
      ? liveSeatOrder.filter(Boolean).slice(0, 4)
      : state.seatOrder
  const index = clampStarterSeatIndex(state.roundStarterSeatIndex, 0)
  return order[index] ?? null
}

type RawWindState = Partial<TableWindState> & {
  roundStarterPlayerId?: string
}

/** Normalize stored JSON (including legacy player-based starter) into seat-index state. */
export function normalizeTableWindState(value: unknown): TableWindState | null {
  if (!value || typeof value !== 'object') return null
  const state = value as RawWindState
  if (!WINDS.includes(state.roundWind as Wind)) return null
  if (typeof state.dealerPlayerId !== 'string' || !state.dealerPlayerId)
    return null
  if (
    !Number.isInteger(state.handNumber) ||
    (state.handNumber as number) < 1
  )
    return null
  if (
    !Array.isArray(state.seatOrder) ||
    state.seatOrder.length !== 4 ||
    !state.seatOrder.every((id) => typeof id === 'string' && id)
  )
    return null
  if (!state.seatOrder.includes(state.dealerPlayerId)) return null

  let starterSeat = clampStarterSeatIndex(state.roundStarterSeatIndex, -1)
  if (starterSeat < 0) {
    if (
      typeof state.roundStarterPlayerId === 'string' &&
      state.roundStarterPlayerId
    ) {
      starterSeat = state.seatOrder.indexOf(state.roundStarterPlayerId)
    }
    if (starterSeat < 0) {
      starterSeat = state.seatOrder.indexOf(state.dealerPlayerId)
    }
  }
  if (starterSeat < 0) return null

  return {
    roundWind: state.roundWind as Wind,
    dealerPlayerId: state.dealerPlayerId,
    roundStarterSeatIndex: starterSeat,
    handNumber: state.handNumber as number,
    seatOrder: [...state.seatOrder],
  }
}

export function isTableWindState(value: unknown): value is TableWindState {
  return normalizeTableWindState(value) != null
}

export function parseTableWindsMap(value: unknown): TableWindsMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  const result: TableWindsMap = {}
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    const normalized = normalizeTableWindState(entry)
    if (normalized) result[key] = normalized
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
  const starterSeat = order.indexOf(starterPlayerId)
  if (starterSeat < 0) {
    throw new Error('Starter must be seated at the table.')
  }
  return {
    roundWind: 'east',
    dealerPlayerId: starterPlayerId,
    roundStarterSeatIndex: starterSeat,
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

  const starterSeat = clampStarterSeatIndex(
    input.state.roundStarterSeatIndex,
    0,
  )
  const base: TableWindState = {
    ...input.state,
    roundStarterSeatIndex: starterSeat,
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

  let dealerIndex = order.indexOf(base.dealerPlayerId)
  // Stale dealer after a roster change — heal from the stored seat snapshot
  // (not the overwritten live order) so round wind can still advance.
  if (dealerIndex < 0) {
    const healed = continueWindsAfterRosterChange(input.state, order)
    if (healed && order.includes(healed.dealerPlayerId)) {
      const healedOrder =
        healed.seatOrder.length === 4 &&
        healed.seatOrder.every((id) => order.includes(id)) &&
        order.every((id) => healed.seatOrder.includes(id))
          ? healed.seatOrder
          : order
      return nextWindState({
        ...input,
        state: healed,
        liveSeatOrder: healedOrder,
      })
    }
    return {
      state: { ...base, handNumber: base.handNumber + 1 },
      rotated: false,
      advancedRound: false,
    }
  }

  const nextDealerIndex = (dealerIndex + 1) % 4
  const nextDealer = order[nextDealerIndex]!
  let roundWind = base.roundWind
  let advancedRound = false

  // Round advances when dealership returns to the starter *chair*.
  if (nextDealerIndex === starterSeat) {
    roundWind = nextWind(base.roundWind)
    advancedRound = true
  }

  return {
    state: {
      roundWind,
      dealerPlayerId: nextDealer,
      roundStarterSeatIndex: starterSeat,
      handNumber: base.handNumber + 1,
      seatOrder: [...order],
    },
    rotated: true,
    advancedRound,
  }
}

/**
 * Place a newcomer in the vacated wind seat instead of appending to the end.
 * Prefers wind seatOrder; falls back to any prior 4-seat snapshot that still
 * contains exactly one player missing from the live list.
 */
export function seatReplacementOrder(
  windSeatOrder: string[] | undefined,
  liveSeats: string[],
  newPlayerId: string,
  priorSeats?: string[],
): string[] {
  const current = liveSeats.filter(Boolean)
  if (!newPlayerId) return current.slice(0, 4)
  if (current.includes(newPlayerId)) return current.slice(0, 4)
  if (current.length >= 4) return current.slice(0, 4)

  for (const snapshot of [windSeatOrder, priorSeats]) {
    if (snapshot?.length === 4 && current.length === 3) {
      const left = snapshot.filter((id) => !current.includes(id))
      if (left.length === 1) {
        return snapshot.map((id) => (id === left[0] ? newPlayerId : id))
      }
    }
  }
  return [...current, newPlayerId].slice(0, 4)
}

/**
 * After a seat change: keep the current round/hand when possible.
 * Round starter is a seat index, so substitutes keep the same cycle chair.
 */
export function continueWindsAfterRosterChange(
  state: TableWindState | undefined,
  liveSeatOrder: string[],
): TableWindState | null {
  if (!state) return null
  const order = liveSeatOrder.filter(Boolean).slice(0, 4)
  const starterSeat = clampStarterSeatIndex(state.roundStarterSeatIndex, 0)

  // Cleared table — drop winds.
  if (order.length === 0) return null

  // Incomplete table — pause winds so a swap can resume the same hand/round.
  if (order.length !== 4) {
    return { ...state, roundStarterSeatIndex: starterSeat }
  }

  const previous = state.seatOrder.filter(Boolean)
  const left = previous.filter((id) => !order.includes(id))
  const joined = order.filter((id) => !previous.includes(id))

  if (left.length === 1 && joined.length === 1) {
    const from = left[0]!
    const to = joined[0]!
    const mapId = (id: string) => (id === from ? to : id)
    const preserved = previous.map(mapId)
    // True substitute keeps the vacated chair only when the other three
    // players stayed in relative order. Table shuffle can also be 1-left /
    // 1-joined while reshuffling everyone — then trust live seat order.
    const previousRemaining = previous.filter((id) => id !== from)
    const liveRemaining = order.filter((id) => id !== to)
    const remainingOrderKept =
      previousRemaining.length === liveRemaining.length &&
      previousRemaining.every((id, index) => id === liveRemaining[index])
    const seatOrder = remainingOrderKept ? preserved : [...order]
    return {
      ...state,
      dealerPlayerId: mapId(state.dealerPlayerId),
      roundStarterSeatIndex: starterSeat,
      seatOrder,
    }
  }

  // Pure seat rearrange (same four players).
  // - Exactly two seats swapped (focused tap-swap): East follows the chair.
  // - Larger reshuffle (table shuffler): dealer stays with the person.
  // Starter chair index never moves with a person.
  if (left.length === 0 && joined.length === 0 && previous.length === 4) {
    const diffIndexes: number[] = []
    for (let index = 0; index < 4; index++) {
      if (previous[index] !== order[index]) diffIndexes.push(index)
    }
    const isPairSwap =
      diffIndexes.length === 2 &&
      previous[diffIndexes[0]!] === order[diffIndexes[1]!] &&
      previous[diffIndexes[1]!] === order[diffIndexes[0]!]

    if (isPairSwap) {
      const dealerIndex = previous.indexOf(state.dealerPlayerId)
      const newDealer =
        dealerIndex >= 0 ? order[dealerIndex]! : state.dealerPlayerId
      return {
        ...state,
        dealerPlayerId: newDealer,
        roundStarterSeatIndex: starterSeat,
        seatOrder: [...order],
      }
    }

    const dealer = order.includes(state.dealerPlayerId)
      ? state.dealerPlayerId
      : (order[starterSeat] ?? order[0]!)
    return {
      ...state,
      dealerPlayerId: dealer,
      roundStarterSeatIndex: starterSeat,
      seatOrder: [...order],
    }
  }

  if (order.includes(state.dealerPlayerId)) {
    return {
      ...state,
      roundStarterSeatIndex: starterSeat,
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
      roundStarterSeatIndex: starterSeat,
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
    roundStarterSeatIndex: clampStarterSeatIndex(
      state.roundStarterSeatIndex,
      0,
    ),
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
