import { BASE_TILE_IDS, BASE_TILE_INDEX, countTiles } from '@/lib/mahjong-hk/tiles'
import type { HandState, ObservedGameState, StateValidation } from '@/lib/mahjong-hk/state'

export function validateHandState(hand: HandState, expectDrawnState?: boolean): StateValidation {
  const errors: string[] = []
  if (hand.concealed.length !== BASE_TILE_IDS.length) errors.push('Concealed tile vector must contain 34 counts.')
  for (let index = 0; index < Math.min(hand.concealed.length, BASE_TILE_IDS.length); index += 1) {
    if (!Number.isInteger(hand.concealed[index]) || hand.concealed[index] < 0 || hand.concealed[index] > 4) {
      errors.push(`${BASE_TILE_IDS[index]} has an invalid concealed count.`)
    }
  }
  if (hand.melds.length > 4) errors.push('A hand cannot contain more than four declared melds.')
  const expectedResting = 13 - hand.melds.length * 3
  const concealedTotal = countTiles(hand.concealed)
  if (expectDrawnState === true && concealedTotal !== expectedResting + 1) {
    errors.push(`Expected ${expectedResting + 1} concealed tiles after a draw, found ${concealedTotal}.`)
  } else if (expectDrawnState === false && concealedTotal !== expectedResting) {
    errors.push(`Expected ${expectedResting} concealed tiles between turns, found ${concealedTotal}.`)
  } else if (expectDrawnState === undefined && concealedTotal !== expectedResting && concealedTotal !== expectedResting + 1) {
    errors.push(`Expected ${expectedResting} or ${expectedResting + 1} concealed tiles, found ${concealedTotal}.`)
  }
  return { valid: errors.length === 0, errors }
}

export function validateObservedState(state: ObservedGameState): StateValidation {
  const errors = [...validateHandState(state.hand).errors]
  const visibleCounts = new Uint8Array(BASE_TILE_IDS.length)
  state.hand.concealed.forEach((count, index) => { visibleCounts[index] += count })
  for (const discards of state.discardsBySeat) {
    for (const tile of discards) visibleCounts[BASE_TILE_INDEX[tile]] += 1
  }
  for (const [seat, melds] of state.exposedMeldsBySeat.entries()) {
    if (seat === state.userSeat) continue
    for (const meld of melds) for (const tile of meld.tiles) visibleCounts[BASE_TILE_INDEX[tile]] += 1
  }
  state.hand.melds.forEach((meld) => meld.tiles.forEach((tile) => { visibleCounts[BASE_TILE_INDEX[tile]] += 1 }))
  visibleCounts.forEach((count, index) => {
    if (count > 4) errors.push(`More than four visible copies of ${BASE_TILE_IDS[index]}.`)
  })
  if (state.discardsBySeat.length !== 4 || state.exposedMeldsBySeat.length !== 4 || state.bonusTilesBySeat.length !== 4) {
    errors.push('Observed table state must contain exactly four seats.')
  }
  if (state.observationConfidence < 0 || state.observationConfidence > 1) errors.push('Observation confidence must be between 0 and 1.')
  return { valid: errors.length === 0, errors }
}
