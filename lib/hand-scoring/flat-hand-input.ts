import type { MahjongTileId } from '@/components/MahjongTile'
import { calculateFan } from './calculate-fan'
import { ORPHAN_TILES } from './pattern-compatibility'
import { allHandTiles, isChow, isPongOrKong } from './tile-utils'
import type { HandScoringInput, Meld, Wind } from './types'
import { DEFAULT_SCORING_RULES } from '@/lib/scoring-rules'

/** Standard winning hand without kongs. */
export const FLAT_HAND_TILE_COUNT = 14
/** Four kongs + pair uses 18 tiles. */
export const FLAT_HAND_MAX_TILE_COUNT = 18

export type HandGroupingKind = 'standard' | 'seven-pairs' | 'thirteen-orphans'

export type HandGrouping = {
  melds: Meld[]
  pair?: MahjongTileId[]
  kind: HandGroupingKind
}

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

function cloneCounts(counts: Map<MahjongTileId, number>): Map<MahjongTileId, number> {
  return new Map(counts)
}

function numberedTileId(suit: NumberedSuit, rank: number): MahjongTileId {
  return `${SUIT_PREFIX[suit]}${rank}` as MahjongTileId
}

function decrementCount(counts: Map<MahjongTileId, number>, tile: MahjongTileId, amount = 1) {
  const next = (counts.get(tile) ?? 0) - amount
  if (next <= 0) counts.delete(tile)
  else counts.set(tile, next)
}

function concealedMeld(tiles: MahjongTileId[]): Meld {
  return { tiles, concealed: true }
}

function tileSortedKey(tiles: MahjongTileId[]): string {
  return [...tiles].sort().join(',')
}

function groupingKey(grouping: HandGrouping): string {
  const meldKeys = grouping.melds.map((meld) => tileSortedKey(meld.tiles)).sort()
  const pairKey = grouping.pair ? tileSortedKey(grouping.pair) : ''
  return `${grouping.kind}|${meldKeys.join(';')}|${pairKey}`
}

function isCompleteThirteenOrphans(counts: Map<MahjongTileId, number>, tileCount: number): boolean {
  if (tileCount !== FLAT_HAND_TILE_COUNT) return false
  let pairFound = false
  for (const orphan of ORPHAN_TILES) {
    const c = counts.get(orphan) ?? 0
    if (c === 0) return false
    if (c === 2) {
      if (pairFound) return false
      pairFound = true
    } else if (c !== 1) return false
  }
  if (!pairFound) return false
  for (const [tile] of counts) {
    if (!ORPHAN_TILES.includes(tile)) return false
  }
  return true
}

function isCompleteSevenPairs(counts: Map<MahjongTileId, number>, tileCount: number): boolean {
  if (tileCount !== FLAT_HAND_TILE_COUNT) return false
  if (counts.size !== 7) return false
  for (const count of counts.values()) {
    if (count !== 2) return false
  }
  return true
}

function orphanStyleMelds(counts: Map<MahjongTileId, number>): HandGrouping {
  let pair: MahjongTileId[] | undefined
  const singles: MahjongTileId[] = []

  for (const [tile, count] of counts) {
    if (count === 2) pair = [tile, tile]
    else singles.push(tile)
  }

  const melds: Meld[] = []
  for (let index = 0; index < singles.length; index += 2) {
    melds.push(concealedMeld([singles[index], singles[index + 1]]))
  }

  return { melds, pair, kind: 'thirteen-orphans' }
}

function sevenPairsMelds(counts: Map<MahjongTileId, number>): HandGrouping {
  const pairTiles = [...counts.keys()]
  const pairTile = pairTiles.pop()!
  return {
    melds: pairTiles.map((tile) => concealedMeld([tile, tile])),
    pair: [pairTile, pairTile],
    kind: 'seven-pairs',
  }
}

function possibleMeldsFrom(counts: Map<MahjongTileId, number>): MahjongTileId[][] {
  const options: MahjongTileId[][] = []
  const tiles = [...counts.keys()].sort()

  for (const tile of tiles) {
    const count = counts.get(tile) ?? 0
    if (count >= 4) options.push([tile, tile, tile, tile])
    if (count >= 3) options.push([tile, tile, tile])
  }

  for (const suit of NUMBERED_SUITS) {
    for (let rank = 1; rank <= 7; rank += 1) {
      const first = numberedTileId(suit, rank)
      const second = numberedTileId(suit, rank + 1)
      const third = numberedTileId(suit, rank + 2)
      if ((counts.get(first) ?? 0) > 0 && (counts.get(second) ?? 0) > 0 && (counts.get(third) ?? 0) > 0) {
        options.push([first, second, third])
      }
    }
  }

  return options
}

function enumerateStandardFromCounts(counts: Map<MahjongTileId, number>): HandGrouping[] {
  const results: HandGrouping[] = []
  const seen = new Set<string>()

  const pairCandidates = [...counts.entries()]
    .filter(([, count]) => count >= 2)
    .map(([tile]) => tile)

  for (const pairTile of pairCandidates) {
    const afterPair = cloneCounts(counts)
    decrementCount(afterPair, pairTile, 2)
    const pair: MahjongTileId[] = [pairTile, pairTile]

    const search = (remaining: Map<MahjongTileId, number>, melds: MahjongTileId[][]) => {
      if (melds.length === 4) {
        if (remaining.size === 0) {
          const grouping: HandGrouping = {
            melds: melds.map((tiles) => concealedMeld(tiles)),
            pair,
            kind: 'standard',
          }
          const key = groupingKey(grouping)
          if (!seen.has(key)) {
            seen.add(key)
            results.push(grouping)
          }
        }
        return
      }

      if (remaining.size === 0) return

      const options = possibleMeldsFrom(remaining)
      if (options.length === 0) return

      // Canonicalize branch order by meld key so we explore deterministically.
      const uniqueOptions = new Map<string, MahjongTileId[]>()
      for (const option of options) uniqueOptions.set(tileSortedKey(option), option)

      for (const option of uniqueOptions.values()) {
        const next = cloneCounts(remaining)
        for (const tile of option) decrementCount(next, tile)
        search(next, [...melds, option])
      }
    }

    search(afterPair, [])
  }

  return results
}

/**
 * Find every valid way to group a tile bag into a scoring hand.
 * Returns [] when the bag is incomplete or cannot form a legal hand.
 */
export function enumerateHandGroupings(tiles: MahjongTileId[]): HandGrouping[] {
  if (tiles.length < FLAT_HAND_TILE_COUNT || tiles.length > FLAT_HAND_MAX_TILE_COUNT) return []

  const counts = countTiles(tiles)
  const groupings: HandGrouping[] = []

  if (isCompleteSevenPairs(counts, tiles.length)) {
    groupings.push(sevenPairsMelds(counts))
  }

  if (isCompleteThirteenOrphans(counts, tiles.length)) {
    groupings.push(orphanStyleMelds(counts))
  }

  if (tiles.length >= FLAT_HAND_TILE_COUNT) {
    groupings.push(...enumerateStandardFromCounts(counts))
  }

  return groupings
}

function probeFan(grouping: HandGrouping, includeNonTraditional: boolean): number {
  const input: HandScoringInput = {
    seatWind: 'east' as Wind,
    roundWind: 'east' as Wind,
    flowers: [],
    melds: grouping.melds,
    pair: grouping.pair,
    bonuses: new Set(),
    includeNonTraditional,
  }
  return calculateFan(input, DEFAULT_SCORING_RULES).rawFan
}

/**
 * Pick the best default grouping index.
 * Prefer standard 4+1 over specials when both exist; among standards prefer highest fan.
 */
export function preferHandGrouping(
  groupings: HandGrouping[],
  options: { includeNonTraditional?: boolean } = {},
): number {
  if (groupings.length === 0) return 0
  if (groupings.length === 1) return 0

  const includeNonTraditional = options.includeNonTraditional ?? true
  const standardIndexes = groupings
    .map((grouping, index) => ({ grouping, index }))
    .filter(({ grouping }) => grouping.kind === 'standard')

  const candidates = standardIndexes.length > 0 ? standardIndexes : groupings.map((grouping, index) => ({ grouping, index }))

  let bestIndex = candidates[0].index
  let bestFan = -1
  for (const { grouping, index } of candidates) {
    const fan = probeFan(grouping, includeNonTraditional)
    if (fan > bestFan) {
      bestFan = fan
      bestIndex = index
    }
  }
  return bestIndex
}

/** Apply concealment flags from a previous grouping onto a new one by matching meld tile multisets. */
export function transferConcealment(from: Meld[], to: Meld[]): Meld[] {
  const available = from.map((meld) => ({
    key: tileSortedKey(meld.tiles),
    concealed: meld.concealed,
    used: false,
  }))

  return to.map((meld) => {
    const key = tileSortedKey(meld.tiles)
    const match = available.find((entry) => !entry.used && entry.key === key)
    if (!match) return { ...meld, concealed: true }
    match.used = true
    return { ...meld, concealed: match.concealed }
  })
}

/** @deprecated Prefer enumerateHandGroupings + preferHandGrouping. */
export function flatTilesToMeldsAndPair(tiles: MahjongTileId[]): { melds: Meld[]; pair?: MahjongTileId[] } {
  const groupings = enumerateHandGroupings(tiles)
  if (groupings.length === 0) return { melds: [] }
  const preferred = groupings[preferHandGrouping(groupings)]
  return { melds: preferred.melds, pair: preferred.pair }
}

export function flatTilesMatchHand(flatTiles: MahjongTileId[], melds: Meld[], pair?: MahjongTileId[]): boolean {
  const fromFlat = flatTilesToMeldsAndPair(flatTiles)
  const left = [...allHandTiles({ melds: fromFlat.melds, pair: fromFlat.pair })].sort()
  const right = [...allHandTiles({ melds, pair })].sort()
  return left.length === right.length && left.every((tile, index) => tile === right[index])
}

export function isLegalGroupedHand(grouping: HandGrouping | null | undefined): boolean {
  if (!grouping?.pair || grouping.pair.length !== 2 || grouping.pair[0] !== grouping.pair[1]) return false

  if (grouping.kind === 'seven-pairs') {
    return (
      grouping.melds.length === 6 &&
      grouping.melds.every((meld) => meld.tiles.length === 2 && meld.tiles[0] === meld.tiles[1])
    )
  }

  if (grouping.kind === 'thirteen-orphans') {
    const tiles = allHandTiles({ melds: grouping.melds, pair: grouping.pair })
    return tiles.length === FLAT_HAND_TILE_COUNT && isCompleteThirteenOrphans(countTiles(tiles), tiles.length)
  }

  if (grouping.melds.length !== 4) return false
  return grouping.melds.every((meld) => isChow(meld) || isPongOrKong(meld))
}
