import type { MahjongTileId } from '@/components/MahjongTile'
import { allHandTiles, isChow, isPongOrKong } from './tile-utils'
import type { Meld } from './types'

export const COMPLETE_HAND_TILE_COUNT = 14
export const COMPLETE_HAND_MAX_TILE_COUNT = 18

export function isCompleteHand(input: { melds: Meld[]; pair?: MahjongTileId[] }): boolean {
  const tiles = allHandTiles(input)
  if (tiles.length < COMPLETE_HAND_TILE_COUNT || tiles.length > COMPLETE_HAND_MAX_TILE_COUNT) return false
  if (!input.pair || input.pair.length !== 2 || input.pair[0] !== input.pair[1]) return false
  if (input.melds.length === 0) return false

  // Seven pairs: six pair-melds + eye
  if (input.melds.length === 6 && input.melds.every((meld) => meld.tiles.length === 2 && meld.tiles[0] === meld.tiles[1])) {
    return tiles.length === COMPLETE_HAND_TILE_COUNT
  }

  // Thirteen orphans: six 2-tile buckets + eye (structural buckets, not real melds)
  if (
    input.melds.length === 6 &&
    input.melds.every((meld) => meld.tiles.length === 2) &&
    tiles.length === COMPLETE_HAND_TILE_COUNT
  ) {
    return true
  }

  // Standard: four chows/pongs/kongs + pair
  if (input.melds.length !== 4) return false
  if (!input.melds.every((meld) => isChow(meld) || isPongOrKong(meld))) return false

  const kongExtras = input.melds.reduce((sum, meld) => sum + Math.max(0, meld.tiles.length - 3), 0)
  return tiles.length === COMPLETE_HAND_TILE_COUNT + kongExtras
}
