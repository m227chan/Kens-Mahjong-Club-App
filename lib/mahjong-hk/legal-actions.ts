import type { HkRules } from '@/lib/mahjong-hk/rules/hk-classical-v1'
import { scoreWin } from '@/lib/mahjong-hk/scoring'
import type { GameEvent, LegalAction, ObservedGameState } from '@/lib/mahjong-hk/state'
import { previousSeat } from '@/lib/mahjong-hk/state'
import { BASE_TILE_IDS, BASE_TILE_INDEX, isHonor, tileRank, type BaseTileId } from '@/lib/mahjong-hk/tiles'
import { validateObservedState } from '@/lib/mahjong-hk/validation'

function withAddedTile(state: ObservedGameState, tile: BaseTileId) {
  const concealed = new Uint8Array(state.hand.concealed)
  concealed[BASE_TILE_INDEX[tile]] += 1
  return { ...state.hand, concealed }
}

function chowOptions(tile: BaseTileId, state: ObservedGameState): LegalAction[] {
  const index = BASE_TILE_INDEX[tile]
  const rank = tileRank(index)
  if (isHonor(index) || rank === null) return []
  const result: LegalAction[] = []
  for (const offset of [-2, -1, 0]) {
    const startRank = rank + offset
    if (startRank < 1 || startRank > 7) continue
    const start = index + offset
    const indices = [start, start + 1, start + 2]
    const needed = indices.filter((candidate) => candidate !== index)
    if (needed.every((candidate) => state.hand.concealed[candidate] > 0)) {
      result.push({
        type: 'chow',
        tiles: indices.map((candidate) => BASE_TILE_IDS[candidate]) as [BaseTileId, BaseTileId, BaseTileId],
        claimedTile: tile,
      })
    }
  }
  return result
}

export function legalActions(state: ObservedGameState, event: GameEvent, rules: HkRules): LegalAction[] {
  if (!validateObservedState(state).valid) return []
  if (event.type === 'USER_DRAW_CONFIRMED') {
    const actions: LegalAction[] = []
    const selfDraw = scoreWin(state.hand, { winType: 'self_draw', winningTile: event.tile }, rules)
    if (selfDraw.valid && selfDraw.meetsMinimum) actions.push({ type: 'win', winType: 'self_draw', tile: event.tile })
    state.hand.concealed.forEach((count, index) => {
      if (count > 0) actions.push({ type: 'discard', tile: BASE_TILE_IDS[index] })
      if (count === 4) actions.push({ type: 'kong', tile: BASE_TILE_IDS[index], kind: 'concealed' })
    })
    state.hand.melds.forEach((meld) => {
      if (meld.exposed && meld.kind === 'pong' && state.hand.concealed[BASE_TILE_INDEX[meld.tiles[0]]] > 0) {
        actions.push({ type: 'kong', tile: meld.tiles[0], kind: 'added' })
      }
    })
    return actions
  }
  if (event.type === 'DISCARD_DETECTED') {
    const actions: LegalAction[] = [{ type: 'pass' }]
    const count = state.hand.concealed[BASE_TILE_INDEX[event.tile]]
    const completed = withAddedTile(state, event.tile)
    const discardWin = scoreWin(completed, { winType: 'discard', winningTile: event.tile, sourceSeat: event.sourceSeat }, rules)
    if (discardWin.valid && discardWin.meetsMinimum) actions.unshift({ type: 'win', winType: 'discard', tile: event.tile })
    if (count >= 2) actions.push({ type: 'pong', tile: event.tile })
    if (count >= 3) actions.push({ type: 'kong', tile: event.tile, kind: 'exposed' })
    const chowSourceAllowed = !rules.chowFromPreviousSeatOnly || event.sourceSeat === previousSeat(state.userSeat)
    if (chowSourceAllowed) actions.push(...chowOptions(event.tile, state))
    return actions
  }
  return [{ type: 'pass' }]
}
