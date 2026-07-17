import type { HkRules, Wind } from '@/lib/mahjong-hk/rules/hk-classical-v1'
import type { BaseTileId, BonusTileId } from '@/lib/mahjong-hk/tiles'

export type Seat = 0 | 1 | 2 | 3
export type MeldKind = 'chow' | 'pong' | 'kong'

export interface Meld {
  kind: MeldKind
  tiles: BaseTileId[]
  exposed: boolean
  fromSeat?: Seat
}

export interface HandState {
  concealed: Uint8Array
  melds: Meld[]
  bonusTiles: BonusTileId[]
  drawnTile?: BaseTileId
  seatWind: Wind
  roundWind?: Wind
}

export type WinType = 'self_draw' | 'discard' | 'robbing_kong' | 'replacement_draw'

export interface WinContext {
  winType: WinType
  winningTile?: BaseTileId
  sourceSeat?: Seat | null
  lastTile?: boolean
}

export interface VisibleTiles {
  discardsBySeat: BaseTileId[][]
  exposedMeldsBySeat: Meld[][]
  bonusTilesBySeat: BonusTileId[][]
}

export type GameEvent =
  | { type: 'INITIAL_STATE_CONFIRMED' }
  | { type: 'USER_DRAW_CONFIRMED'; tile: BaseTileId }
  | { type: 'DISCARD_DETECTED'; tile: BaseTileId; sourceSeat: Seat | null; trackId?: string }
  | { type: 'CALL_DETECTED'; seat: Seat; call: MeldKind; tiles: BaseTileId[] }
  | { type: 'USER_DISCARD_CONFIRMED'; tile: BaseTileId }
  | { type: 'ROUND_RESET' }
  | { type: 'MANUAL_CORRECTION' }

export interface ObservedGameState {
  hand: HandState
  discardsBySeat: BaseTileId[][]
  exposedMeldsBySeat: Meld[][]
  bonusTilesBySeat: BonusTileId[][]
  activeSeat: Seat | null
  userSeat: Seat
  tilesRemainingEstimate: number
  lastEvent: GameEvent | null
  observationConfidence: number
  rulesVersion: string
  version: number
}

export type LegalAction =
  | { type: 'win'; winType: WinType; tile?: BaseTileId }
  | { type: 'pass' }
  | { type: 'discard'; tile: BaseTileId }
  | { type: 'chow'; tiles: [BaseTileId, BaseTileId, BaseTileId]; claimedTile: BaseTileId }
  | { type: 'pong'; tile: BaseTileId }
  | { type: 'kong'; tile: BaseTileId; kind: 'concealed' | 'exposed' | 'added' }

export interface StateValidation {
  valid: boolean
  errors: string[]
}

export interface EngineContext {
  rules: HkRules
  state: ObservedGameState
}

export function previousSeat(seat: Seat): Seat {
  return ((seat + 3) % 4) as Seat
}

