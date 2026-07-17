export const BASE_TILE_IDS = [
  'characters_1', 'characters_2', 'characters_3', 'characters_4', 'characters_5',
  'characters_6', 'characters_7', 'characters_8', 'characters_9',
  'bamboo_1', 'bamboo_2', 'bamboo_3', 'bamboo_4', 'bamboo_5',
  'bamboo_6', 'bamboo_7', 'bamboo_8', 'bamboo_9',
  'dots_1', 'dots_2', 'dots_3', 'dots_4', 'dots_5',
  'dots_6', 'dots_7', 'dots_8', 'dots_9',
  'east', 'south', 'west', 'north',
  'red_dragon', 'green_dragon', 'white_dragon',
] as const

export const BONUS_TILE_IDS = [
  'flower_plum', 'flower_orchid', 'flower_chrysanthemum', 'flower_bamboo',
  'season_spring', 'season_summer', 'season_autumn', 'season_winter',
] as const

export type BaseTileId = typeof BASE_TILE_IDS[number]
export type BonusTileId = typeof BONUS_TILE_IDS[number]
export type TileId = BaseTileId | BonusTileId
export type TileSuit = 'characters' | 'bamboo' | 'dots' | 'honor'

export const BASE_TILE_INDEX = Object.freeze(
  Object.fromEntries(BASE_TILE_IDS.map((tile, index) => [tile, index])) as Record<BaseTileId, number>
)

export const TILE_LABELS: Record<TileId, string> = {
  characters_1: '1 Character', characters_2: '2 Characters', characters_3: '3 Characters',
  characters_4: '4 Characters', characters_5: '5 Characters', characters_6: '6 Characters',
  characters_7: '7 Characters', characters_8: '8 Characters', characters_9: '9 Characters',
  bamboo_1: '1 Bamboo', bamboo_2: '2 Bamboo', bamboo_3: '3 Bamboo',
  bamboo_4: '4 Bamboo', bamboo_5: '5 Bamboo', bamboo_6: '6 Bamboo',
  bamboo_7: '7 Bamboo', bamboo_8: '8 Bamboo', bamboo_9: '9 Bamboo',
  dots_1: '1 Dot', dots_2: '2 Dots', dots_3: '3 Dots', dots_4: '4 Dots', dots_5: '5 Dots',
  dots_6: '6 Dots', dots_7: '7 Dots', dots_8: '8 Dots', dots_9: '9 Dots',
  east: 'East Wind', south: 'South Wind', west: 'West Wind', north: 'North Wind',
  red_dragon: 'Red Dragon', green_dragon: 'Green Dragon', white_dragon: 'White Dragon',
  flower_plum: 'Plum Flower', flower_orchid: 'Orchid Flower',
  flower_chrysanthemum: 'Chrysanthemum Flower', flower_bamboo: 'Bamboo Flower',
  season_spring: 'Spring', season_summer: 'Summer', season_autumn: 'Autumn', season_winter: 'Winter',
}

export const TILE_GLYPHS: Record<BaseTileId, string> = {
  characters_1: '🀇', characters_2: '🀈', characters_3: '🀉', characters_4: '🀊', characters_5: '🀋',
  characters_6: '🀌', characters_7: '🀍', characters_8: '🀎', characters_9: '🀏',
  bamboo_1: '🀐', bamboo_2: '🀑', bamboo_3: '🀒', bamboo_4: '🀓', bamboo_5: '🀔',
  bamboo_6: '🀕', bamboo_7: '🀖', bamboo_8: '🀗', bamboo_9: '🀘',
  dots_1: '🀙', dots_2: '🀚', dots_3: '🀛', dots_4: '🀜', dots_5: '🀝',
  dots_6: '🀞', dots_7: '🀟', dots_8: '🀠', dots_9: '🀡',
  east: '🀀', south: '🀁', west: '🀂', north: '🀃',
  red_dragon: '🀄', green_dragon: '🀅', white_dragon: '🀆',
}

export const TERMINAL_HONOR_INDICES = Object.freeze([
  0, 8, 9, 17, 18, 26, 27, 28, 29, 30, 31, 32, 33,
])

export function createEmptyCounts(): Uint8Array {
  return new Uint8Array(BASE_TILE_IDS.length)
}

export function countsFromTiles(tiles: readonly BaseTileId[]): Uint8Array {
  const counts = createEmptyCounts()
  for (const tile of tiles) counts[BASE_TILE_INDEX[tile]] += 1
  return counts
}

export function tilesFromCounts(counts: ArrayLike<number>): BaseTileId[] {
  const tiles: BaseTileId[] = []
  BASE_TILE_IDS.forEach((tile, index) => {
    for (let copy = 0; copy < (counts[index] ?? 0); copy += 1) tiles.push(tile)
  })
  return tiles
}

export function countTiles(counts: ArrayLike<number>): number {
  let total = 0
  for (let index = 0; index < BASE_TILE_IDS.length; index += 1) total += counts[index] ?? 0
  return total
}

export function tileSuit(indexOrTile: number | BaseTileId): TileSuit {
  const index = typeof indexOrTile === 'number' ? indexOrTile : BASE_TILE_INDEX[indexOrTile]
  if (index < 9) return 'characters'
  if (index < 18) return 'bamboo'
  if (index < 27) return 'dots'
  return 'honor'
}

export function tileRank(indexOrTile: number | BaseTileId): number | null {
  const index = typeof indexOrTile === 'number' ? indexOrTile : BASE_TILE_INDEX[indexOrTile]
  return index < 27 ? (index % 9) + 1 : null
}

export function isHonor(indexOrTile: number | BaseTileId): boolean {
  return (typeof indexOrTile === 'number' ? indexOrTile : BASE_TILE_INDEX[indexOrTile]) >= 27
}

export function isTerminal(indexOrTile: number | BaseTileId): boolean {
  const rank = tileRank(indexOrTile)
  return rank === 1 || rank === 9
}

export function isDragon(tile: BaseTileId): boolean {
  return tile === 'red_dragon' || tile === 'green_dragon' || tile === 'white_dragon'
}

export function isWind(tile: BaseTileId): boolean {
  return tile === 'east' || tile === 'south' || tile === 'west' || tile === 'north'
}

