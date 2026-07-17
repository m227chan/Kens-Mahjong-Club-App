import type { ObservedGameState } from '@/lib/mahjong-hk/state'
import { BASE_TILE_IDS, BASE_TILE_INDEX, type BaseTileId } from '@/lib/mahjong-hk/tiles'

export function unseenTileCounts(state: ObservedGameState): Uint8Array {
  const unseen = new Uint8Array(BASE_TILE_IDS.length).fill(4)
  const remove = (tile: BaseTileId) => {
    const index = BASE_TILE_INDEX[tile]
    if (unseen[index] === 0) throw new Error(`Impossible table state: more than four copies of ${tile}.`)
    unseen[index] -= 1
  }
  state.hand.concealed.forEach((count, index) => {
    if (count > unseen[index]) throw new Error(`Impossible hand count for ${BASE_TILE_IDS[index]}.`)
    unseen[index] -= count
  })
  state.hand.melds.forEach((meld) => meld.tiles.forEach(remove))
  state.discardsBySeat.forEach((discards) => discards.forEach(remove))
  state.exposedMeldsBySeat.forEach((melds, seat) => {
    if (seat === state.userSeat) return
    melds.forEach((meld) => meld.tiles.forEach(remove))
  })
  return unseen
}

export function sumCounts(counts: ArrayLike<number>): number {
  let total = 0
  for (let index = 0; index < counts.length; index += 1) total += counts[index] ?? 0
  return total
}

/** Exact probability for a fixed effective set in sampling without replacement. */
export function probabilityAtLeastOne(total: number, effective: number, draws: number): number {
  if (effective <= 0 || draws <= 0 || total <= 0) return 0
  if (effective >= total || draws >= total - effective + 1) return 1
  const boundedDraws = Math.min(draws, total)
  let none = 1
  for (let index = 0; index < boundedDraws; index += 1) {
    none *= (total - effective - index) / (total - index)
  }
  return 1 - none
}

export class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0 || 0x9e3779b9
  }

  next(): number {
    let value = this.state
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    this.state = value >>> 0
    return this.state / 0x100000000
  }
}

export function drawTileIndex(counts: Uint8Array, random: SeededRandom): number | null {
  const total = sumCounts(counts)
  if (total === 0) return null
  let target = Math.floor(random.next() * total)
  for (let index = 0; index < counts.length; index += 1) {
    if (target < counts[index]) {
      counts[index] -= 1
      return index
    }
    target -= counts[index]
  }
  return null
}

