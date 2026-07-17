import type { HkRules } from '@/lib/mahjong-hk/rules/hk-classical-v1'
import type { HandState, Meld, VisibleTiles } from '@/lib/mahjong-hk/state'
import {
  BASE_TILE_IDS,
  BASE_TILE_INDEX,
  TERMINAL_HONOR_INDICES,
  countTiles,
  isHonor,
  tileRank,
  tilesFromCounts,
  type BaseTileId,
} from '@/lib/mahjong-hk/tiles'
import { validateHandState } from '@/lib/mahjong-hk/validation'

export interface StandardDecomposition {
  pair: BaseTileId
  melds: Meld[]
}

export type WinningShape = 'standard' | 'seven_pairs' | 'thirteen_orphans'

export interface WinResult {
  shape: WinningShape
  decompositions: StandardDecomposition[]
}

export interface EffectiveTile {
  tile: BaseTileId
  resultingDeficiency: number
  remaining: number
}

const MAX_DECOMPOSITIONS = 128
const deficiencyCache = new Map<string, number>()

function cloneCounts(counts: Uint8Array): Uint8Array {
  return new Uint8Array(counts)
}

function firstNonZero(counts: Uint8Array): number {
  for (let index = 0; index < counts.length; index += 1) if (counts[index] > 0) return index
  return -1
}

export function findStandardDecompositions(hand: HandState): StandardDecomposition[] {
  const groupsNeeded = 4 - hand.melds.length
  if (groupsNeeded < 0 || countTiles(hand.concealed) !== groupsNeeded * 3 + 2) return []
  const counts = cloneCounts(hand.concealed)
  const results: StandardDecomposition[] = []

  const visit = (melds: Meld[], pair: BaseTileId | null) => {
    if (results.length >= MAX_DECOMPOSITIONS) return
    const index = firstNonZero(counts)
    if (index === -1) {
      if (pair && melds.length === groupsNeeded) results.push({ pair, melds: [...hand.melds, ...melds] })
      return
    }
    if (melds.length > groupsNeeded) return
    const tile = BASE_TILE_IDS[index]

    if (!pair && counts[index] >= 2) {
      counts[index] -= 2
      visit(melds, tile)
      counts[index] += 2
    }
    if (counts[index] >= 3) {
      counts[index] -= 3
      visit([...melds, { kind: 'pong', tiles: [tile, tile, tile], exposed: false }], pair)
      counts[index] += 3
    }
    const rank = tileRank(index)
    if (!isHonor(index) && rank !== null && rank <= 7 && counts[index + 1] > 0 && counts[index + 2] > 0) {
      counts[index] -= 1
      counts[index + 1] -= 1
      counts[index + 2] -= 1
      visit([...melds, {
        kind: 'chow',
        tiles: [BASE_TILE_IDS[index], BASE_TILE_IDS[index + 1], BASE_TILE_IDS[index + 2]],
        exposed: false,
      }], pair)
      counts[index] += 1
      counts[index + 1] += 1
      counts[index + 2] += 1
    }
  }

  visit([], null)
  return results
}

export function isSevenPairs(counts: Uint8Array): boolean {
  if (countTiles(counts) !== 14) return false
  let pairs = 0
  for (const count of counts) {
    if (count % 2 !== 0) return false
    pairs += count / 2
  }
  return pairs === 7
}

export function isThirteenOrphans(counts: Uint8Array): boolean {
  if (countTiles(counts) !== 14) return false
  const required = new Set(TERMINAL_HONOR_INDICES)
  let pair = false
  for (let index = 0; index < counts.length; index += 1) {
    const count = counts[index]
    if (required.has(index)) {
      if (count === 0) return false
      if (count >= 2) pair = true
    } else if (count > 0) return false
  }
  return pair
}

export function isWinningHand(hand: HandState, rules: HkRules): WinResult | null {
  if (!validateHandState(hand, true).valid) return null
  if (hand.melds.length === 0 && rules.allowThirteenOrphans && isThirteenOrphans(hand.concealed)) {
    return { shape: 'thirteen_orphans', decompositions: [] }
  }
  if (hand.melds.length === 0 && rules.allowSevenPairs && isSevenPairs(hand.concealed)) {
    return { shape: 'seven_pairs', decompositions: [] }
  }
  const decompositions = findStandardDecompositions(hand)
  return decompositions.length ? { shape: 'standard', decompositions } : null
}

function standardDeficiency(countsInput: Uint8Array, fixedMelds: number): number {
  const counts = cloneCounts(countsInput)
  let best = 8

  const visit = (index: number, melds: number, pairs: number, partials: number) => {
    while (index < 34 && counts[index] === 0) index += 1
    if (index >= 34) {
      const totalMelds = Math.min(4, fixedMelds + melds)
      const pairUsed = pairs > 0 ? 1 : 0
      const usablePartials = Math.min(partials + Math.max(0, pairs - pairUsed), 4 - totalMelds)
      best = Math.min(best, 8 - totalMelds * 2 - usablePartials - pairUsed)
      return
    }

    if (counts[index] >= 3) {
      counts[index] -= 3
      visit(index, melds + 1, pairs, partials)
      counts[index] += 3
    }
    const rank = tileRank(index)
    if (!isHonor(index) && rank !== null && rank <= 7 && counts[index + 1] > 0 && counts[index + 2] > 0) {
      counts[index] -= 1; counts[index + 1] -= 1; counts[index + 2] -= 1
      visit(index, melds + 1, pairs, partials)
      counts[index] += 1; counts[index + 1] += 1; counts[index + 2] += 1
    }
    if (counts[index] >= 2) {
      counts[index] -= 2
      visit(index, melds, pairs + 1, partials)
      counts[index] += 2
    }
    if (!isHonor(index) && rank !== null) {
      if (rank <= 8 && counts[index + 1] > 0) {
        counts[index] -= 1; counts[index + 1] -= 1
        visit(index, melds, pairs, partials + 1)
        counts[index] += 1; counts[index + 1] += 1
      }
      if (rank <= 7 && counts[index + 2] > 0) {
        counts[index] -= 1; counts[index + 2] -= 1
        visit(index, melds, pairs, partials + 1)
        counts[index] += 1; counts[index + 2] += 1
      }
    }
    counts[index] -= 1
    visit(index, melds, pairs, partials)
    counts[index] += 1
  }

  visit(0, 0, 0, 0)
  return best
}

function sevenPairsDeficiency(counts: Uint8Array): number {
  let pairs = 0
  let unique = 0
  for (const count of counts) {
    if (count > 0) unique += 1
    if (count >= 2) pairs += 1
  }
  return 6 - Math.min(7, pairs) + Math.max(0, 7 - unique)
}

function thirteenOrphansDeficiency(counts: Uint8Array): number {
  let unique = 0
  let pair = 0
  for (const index of TERMINAL_HONOR_INDICES) {
    if (counts[index] > 0) unique += 1
    if (counts[index] > 1) pair = 1
  }
  return 13 - unique - pair
}

/** Returns -1 for a complete hand, 0 for ready, and higher values otherwise. */
export function deficiency(hand: HandState, rules: HkRules): number {
  const cacheKey = `${hand.melds.length}|${rules.allowSevenPairs ? 1 : 0}${rules.allowThirteenOrphans ? 1 : 0}|${String.fromCharCode(...hand.concealed)}`
  const cached = deficiencyCache.get(cacheKey)
  if (cached !== undefined) return cached
  let result = standardDeficiency(hand.concealed, hand.melds.length)
  if (hand.melds.length === 0 && rules.allowSevenPairs) result = Math.min(result, sevenPairsDeficiency(hand.concealed))
  if (hand.melds.length === 0 && rules.allowThirteenOrphans) result = Math.min(result, thirteenOrphansDeficiency(hand.concealed))
  if (deficiencyCache.size > 20_000) deficiencyCache.clear()
  deficiencyCache.set(cacheKey, result)
  return result
}

export function enumerateWaits(hand: HandState, rules: HkRules): BaseTileId[] {
  const waits: BaseTileId[] = []
  for (let index = 0; index < BASE_TILE_IDS.length; index += 1) {
    if (hand.concealed[index] >= 4) continue
    const concealed = cloneCounts(hand.concealed)
    concealed[index] += 1
    if (isWinningHand({ ...hand, concealed }, rules)) waits.push(BASE_TILE_IDS[index])
  }
  return waits
}

function visibleCount(tile: BaseTileId, hand: HandState, visible?: VisibleTiles): number {
  const index = BASE_TILE_INDEX[tile]
  let count = hand.concealed[index]
  hand.melds.forEach((meld) => meld.tiles.forEach((meldTile) => { if (meldTile === tile) count += 1 }))
  visible?.discardsBySeat.forEach((discards) => discards.forEach((discard) => { if (discard === tile) count += 1 }))
  visible?.exposedMeldsBySeat.forEach((melds) => melds.forEach((meld) => meld.tiles.forEach((meldTile) => {
    if (meldTile === tile) count += 1
  })))
  return count
}

export function effectiveTiles(hand: HandState, rules: HkRules, visible?: VisibleTiles): EffectiveTile[] {
  const current = deficiency(hand, rules)
  const result: EffectiveTile[] = []
  for (let index = 0; index < BASE_TILE_IDS.length; index += 1) {
    const tile = BASE_TILE_IDS[index]
    const seen = visibleCount(tile, hand, visible)
    if (seen >= 4) continue
    const concealed = cloneCounts(hand.concealed)
    concealed[index] += 1
    const next = deficiency({ ...hand, concealed }, rules)
    if (next < current) result.push({ tile, resultingDeficiency: next, remaining: 4 - seen })
  }
  return result
}

export function handFromTiles(tiles: readonly BaseTileId[], partial: Omit<HandState, 'concealed'>): HandState {
  const concealed = new Uint8Array(34)
  tiles.forEach((tile) => { concealed[BASE_TILE_INDEX[tile]] += 1 })
  return { ...partial, concealed }
}

export function handTiles(hand: HandState): BaseTileId[] {
  return tilesFromCounts(hand.concealed)
}
