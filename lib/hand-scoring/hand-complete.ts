import type { MahjongTileId } from '@/components/MahjongTile'
import { allHandTiles } from './tile-utils'
import type { Meld } from './types'

export const COMPLETE_HAND_TILE_COUNT = 14

export function isCompleteHand(input: { melds: Meld[]; pair?: MahjongTileId[] }): boolean {
  const tiles = allHandTiles(input)
  if (tiles.length !== COMPLETE_HAND_TILE_COUNT) return false
  if (input.melds.some((meld) => meld.tiles.length < 2 || meld.tiles.length > 4)) return false
  if (input.pair?.length) {
    if (input.pair.length !== 2 || input.pair[0] !== input.pair[1]) return false
  }
  return input.melds.length > 0 || Boolean(input.pair?.length)
}
