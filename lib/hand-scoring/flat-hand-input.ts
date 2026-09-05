import type { MahjongTileId } from '@/components/MahjongTile'
import { ORPHAN_TILES } from './pattern-compatibility'
import { allHandTiles } from './tile-utils'
import type { Meld } from './types'

export const FLAT_HAND_TILE_COUNT = 14

const NUMBERED_SUITS = ['character', 'bamboo', 'circle'] as const
type NumberedSuit = (typeof NUMBERED_SUITS)[number]

const SUIT_PREFIX: Record<NumberedSuit, string> = {
  character: 'c',
  bamboo: 'b',
  circle: 'o',
}

function countTiles(tiles: MahjongTileId[]): Map<MahjongTileId, number> {
  const counts = new Map<MahjongTileId, number>()
  for (const tile of tiles) counts.set(tile, (counts.get(tile) ?? 0) + 1)
  return counts
}

function numberedTileId(suit: NumberedSuit, rank: number): MahjongTileId {
  return `${SUIT_PREFIX[suit]}${rank}` as MahjongTileId
}

function decrementCount(counts: Map<MahjongTileId, number>, tile: MahjongTileId, amount = 1) {
  const next = (counts.get(tile) ?? 0) - amount
  if (next <= 0) counts.delete(tile)
  else counts.set(tile, next)
}

function expandCounts(counts: Map<MahjongTileId, number>): MahjongTileId[] {
  const tiles: MahjongTileId[] = []
  for (const [tile, count] of counts) {
    for (let index = 0; index < count; index += 1) tiles.push(tile)
  }
  return tiles
}

function concealedMeld(tiles: MahjongTileId[]): Meld {
  return { tiles, concealed: true }
}

function isOrphanStyle(counts: Map<MahjongTileId, number>): boolean {
  let pairCount = 0
  for (const [tile, count] of counts) {
    if (count > 2) return false
    if (count === 2) pairCount += 1
    if (!ORPHAN_TILES.includes(tile)) return false
  }
  return pairCount <= 1
}

function isSevenPairs(counts: Map<MahjongTileId, number>): boolean {
  if (counts.size === 0) return false
  for (const count of counts.values()) {
    if (count !== 2) return false
  }
  return true
}

function orphanStyleMelds(counts: Map<MahjongTileId, number>): { melds: Meld[]; pair?: MahjongTileId[] } {
  let pair: MahjongTileId[] | undefined
  const singles: MahjongTileId[] = []

  for (const [tile, count] of counts) {
    if (count === 2) pair = [tile, tile]
    else singles.push(tile)
  }

  const melds: Meld[] = []
  for (let index = 0; index < singles.length; index += 2) {
    if (index + 1 < singles.length) {
      melds.push(concealedMeld([singles[index], singles[index + 1]]))
    } else {
      melds.push(concealedMeld([singles[index]]))
    }
  }

  return { melds, pair }
}

function sevenPairsMelds(counts: Map<MahjongTileId, number>): { melds: Meld[]; pair?: MahjongTileId[] } {
  const pairTiles = [...counts.keys()]
  const pairTile = pairTiles.pop()
  if (!pairTile) return { melds: [] }
  return {
    melds: pairTiles.map((tile) => concealedMeld([tile, tile])),
    pair: [pairTile, pairTile],
  }
}

function decomposeStandardMelds(counts: Map<MahjongTileId, number>): { melds: Meld[]; pair?: MahjongTileId[] } {
  const working = new Map(counts)
  const melds: Meld[] = []

  for (const suit of NUMBERED_SUITS) {
    for (let rank = 1; rank <= 7; rank += 1) {
      const first = numberedTileId(suit, rank)
      const second = numberedTileId(suit, rank + 1)
      const third = numberedTileId(suit, rank + 2)
      while ((working.get(first) ?? 0) > 0 && (working.get(second) ?? 0) > 0 && (working.get(third) ?? 0) > 0) {
        melds.push(concealedMeld([first, second, third]))
        decrementCount(working, first)
        decrementCount(working, second)
        decrementCount(working, third)
      }
    }
  }

  for (const tile of [...working.keys()]) {
    while ((working.get(tile) ?? 0) >= 4) {
      melds.push(concealedMeld([tile, tile, tile, tile]))
      decrementCount(working, tile, 4)
    }
  }

  for (const tile of [...working.keys()]) {
    while ((working.get(tile) ?? 0) >= 3) {
      melds.push(concealedMeld([tile, tile, tile]))
      decrementCount(working, tile, 3)
    }
  }

  let pair: MahjongTileId[] | undefined
  for (const [tile, count] of [...working]) {
    if (count >= 2) {
      pair = [tile, tile]
      decrementCount(working, tile, 2)
      break
    }
  }

  const remaining = expandCounts(working)
  for (let index = 0; index < remaining.length; index += 2) {
    if (index + 1 < remaining.length) {
      melds.push(concealedMeld([remaining[index], remaining[index + 1]]))
    } else {
      melds.push(concealedMeld([remaining[index]]))
    }
  }

  return { melds, pair }
}

export function flatTilesToMeldsAndPair(tiles: MahjongTileId[]): { melds: Meld[]; pair?: MahjongTileId[] } {
  if (tiles.length === 0) return { melds: [] }

  const counts = countTiles(tiles)
  if (isSevenPairs(counts)) return sevenPairsMelds(counts)
  if (isOrphanStyle(counts)) return orphanStyleMelds(counts)
  return decomposeStandardMelds(counts)
}

export function flatTilesMatchHand(flatTiles: MahjongTileId[], melds: Meld[], pair?: MahjongTileId[]): boolean {
  const fromFlat = flatTilesToMeldsAndPair(flatTiles)
  const left = [...allHandTiles({ melds: fromFlat.melds, pair: fromFlat.pair })].sort()
  const right = [...allHandTiles({ melds, pair })].sort()
  return left.length === right.length && left.every((tile, index) => tile === right[index])
}
