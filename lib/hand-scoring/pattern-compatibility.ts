import type { MahjongTileId } from '@/components/MahjongTile'
import type { HandScoringInput, Meld } from './types'
import {
  allHandTiles,
  isChow,
  isDragon,
  isHonor,
  isKong,
  isPongOrKong,
  isTerminal,
  isWind,
  numberedSuitsInHand,
  parseTile,
} from './tile-utils'

export const ORPHAN_TILES: MahjongTileId[] = [
  'c1', 'c9', 'b1', 'b9', 'o1', 'o9',
  'east', 'south', 'west', 'north', 'red', 'green', 'white',
]

type HandState = {
  tiles: MahjongTileId[]
  tileCount: number
  melds: Meld[]
  meldCount: number
  pair?: MahjongTileId[]
  counts: Map<MahjongTileId, number>
  suits: Set<'character' | 'bamboo' | 'circle'>
  hasOpenMeld: boolean
  hasChow: boolean
  hasPongOrKong: boolean
  hasKong: boolean
  allMeldsConcealed: boolean
  allMeldsPongOrKong: boolean
  allMeldsChow: boolean
  allMeldsPairs: boolean
  openMeldCount: number
}

function buildHandState(input: HandScoringInput): HandState {
  const tiles = allHandTiles(input)
  const counts = new Map<MahjongTileId, number>()
  for (const tile of tiles) counts.set(tile, (counts.get(tile) ?? 0) + 1)

  return {
    tiles,
    tileCount: tiles.length,
    melds: input.melds,
    meldCount: input.melds.length,
    pair: input.pair,
    counts,
    suits: numberedSuitsInHand(tiles),
    hasOpenMeld: input.melds.some((m) => !m.concealed),
    hasChow: input.melds.some(isChow),
    hasPongOrKong: input.melds.some(isPongOrKong),
    hasKong: input.melds.some(isKong),
    allMeldsConcealed: input.melds.length === 0 || input.melds.every((m) => m.concealed),
    allMeldsPongOrKong: input.melds.length === 0 || input.melds.every(isPongOrKong),
    allMeldsChow: input.melds.length === 0 || input.melds.every(isChow),
    allMeldsPairs:
      input.melds.length === 0
      || input.melds.every((m) => m.tiles.length === 2 && m.tiles[0] === m.tiles[1]),
    openMeldCount: input.melds.filter((m) => !m.concealed).length,
  }
}

function withinTileBudget(state: HandState): boolean {
  return state.tileCount <= 14
}

function withinStandardMeldBudget(state: HandState): boolean {
  return state.meldCount <= 4
}

function pairIsValid(state: HandState): boolean {
  if (!state.pair?.length) return true
  return state.pair.length === 2 && state.pair[0] === state.pair[1]
}

function everyTileMatches(state: HandState, predicate: (tile: MahjongTileId) => boolean): boolean {
  return state.tiles.length === 0 || state.tiles.every(predicate)
}

function compatibleThirteenOrphans(state: HandState): boolean {
  if (!withinTileBudget(state)) return false
  if (state.hasChow) return false
  if (state.hasOpenMeld) return false
  if (state.hasPongOrKong) return false
  if (!everyTileMatches(state, (tile) => ORPHAN_TILES.includes(tile))) return false

  for (const [, count] of state.counts) {
    if (count > 2) return false
  }

  let pairCount = 0
  for (const [, count] of state.counts) {
    if (count === 2) pairCount += 1
  }
  if (pairCount > 1) return false

  return true
}

function compatibleSevenPairs(state: HandState): boolean {
  if (!withinTileBudget(state)) return false
  if (!state.allMeldsPairs) return false
  if (!pairIsValid(state)) return false
  if (state.meldCount > 6) return false
  return state.meldCount + (state.pair?.length ? 1 : 0) <= 7
}

function compatibleAllTriplets(state: HandState): boolean {
  if (!withinStandardMeldBudget(state) || !withinTileBudget(state)) return false
  if (state.hasChow) return false
  return state.melds.length === 0 || state.allMeldsPongOrKong
}

function compatibleAllSequences(state: HandState): boolean {
  if (!withinStandardMeldBudget(state) || !withinTileBudget(state)) return false
  if (state.hasPongOrKong) return false
  return state.melds.length === 0 || state.allMeldsChow
}

function compatiblePureFlush(state: HandState): boolean {
  if (!withinStandardMeldBudget(state) || !withinTileBudget(state)) return false
  if (state.suits.size > 1) return false
  return everyTileMatches(state, (tile) => {
    const parsed = parseTile(tile)
    return parsed.kind === 'numbered'
  })
}

function compatibleMixedFlush(state: HandState): boolean {
  if (!withinStandardMeldBudget(state) || !withinTileBudget(state)) return false
  return state.suits.size <= 1
}

function compatibleNineGates(state: HandState): boolean {
  if (!withinTileBudget(state)) return false
  if (!state.allMeldsConcealed) return false
  if (state.hasChow) return false
  if (state.suits.size > 1) return false
  return everyTileMatches(state, (tile) => parseTile(tile).kind === 'numbered')
}

function compatibleConcealedHand(state: HandState): boolean {
  return state.allMeldsConcealed
}

function compatibleFourConcealedTriplets(state: HandState): boolean {
  if (!withinStandardMeldBudget(state) || !withinTileBudget(state)) return false
  if (!state.allMeldsConcealed) return false
  if (state.hasChow) return false
  return state.melds.length === 0 || state.allMeldsPongOrKong
}

function compatibleFourKongs(state: HandState): boolean {
  if (!withinStandardMeldBudget(state) || !withinTileBudget(state)) return false
  if (state.hasChow) return false
  return state.melds.length === 0 || state.allMeldsPongOrKong
}

function compatibleThreeKongs(state: HandState): boolean {
  return compatibleFourKongs(state)
}

function compatibleAllHonors(state: HandState): boolean {
  if (!withinStandardMeldBudget(state) || !withinTileBudget(state)) return false
  return everyTileMatches(state, isHonor)
}

function compatibleAllTerminals(state: HandState): boolean {
  if (!withinStandardMeldBudget(state) || !withinTileBudget(state)) return false
  return everyTileMatches(state, isTerminal)
}

function compatibleMixedTerminals(state: HandState): boolean {
  if (!withinStandardMeldBudget(state) || !withinTileBudget(state)) return false
  return everyTileMatches(state, (tile) => isTerminal(tile) || isHonor(tile))
}

function countWindPongMelds(state: HandState): number {
  return state.melds.filter((meld) => isPongOrKong(meld) && isWind(meld.tiles[0])).length
}

function countDragonPongMelds(state: HandState): number {
  return state.melds.filter((meld) => isPongOrKong(meld) && isDragon(meld.tiles[0])).length
}

function canAddMoreWindPongMelds(state: HandState, targetWindPongMelds: number): boolean {
  if (state.hasChow) return false
  if (!state.melds.every(isPongOrKong)) return false
  if (!state.melds.every((meld) => isWind(meld.tiles[0]))) return false

  const currentWindPongs = countWindPongMelds(state)
  const slotsRemaining = 4 - state.meldCount
  const windPongsStillNeeded = targetWindPongMelds - currentWindPongs
  return windPongsStillNeeded >= 0 && windPongsStillNeeded <= slotsRemaining
}

function canAddMoreDragonPongMelds(state: HandState, targetDragonPongMelds: number): boolean {
  if (state.hasChow) return false
  if (!state.melds.every(isPongOrKong)) return false
  if (!state.melds.every((meld) => isDragon(meld.tiles[0]))) return false

  const currentDragonPongs = countDragonPongMelds(state)
  const slotsRemaining = 4 - state.meldCount
  const dragonPongsStillNeeded = targetDragonPongMelds - currentDragonPongs
  return dragonPongsStillNeeded >= 0 && dragonPongsStillNeeded <= slotsRemaining
}

function compatibleBigFourWinds(state: HandState): boolean {
  if (!withinStandardMeldBudget(state) || !withinTileBudget(state)) return false
  return canAddMoreWindPongMelds(state, 4)
}

function compatibleSmallFourWinds(state: HandState): boolean {
  if (!withinStandardMeldBudget(state) || !withinTileBudget(state)) return false
  if (state.meldCount > 3) return false
  if (state.pair?.length === 2 && !isWind(state.pair[0])) return false
  if (state.pair?.length === 2 && state.pair[0] !== state.pair[1]) return false
  if (state.pair?.length === 2 && isWind(state.pair[0])) {
    const pairWind = state.pair[0]
    if (state.melds.some((meld) => isPongOrKong(meld) && meld.tiles[0] === pairWind)) return false
  }
  return canAddMoreWindPongMelds(state, 3)
}

function compatibleBigThreeDragons(state: HandState): boolean {
  if (!withinStandardMeldBudget(state) || !withinTileBudget(state)) return false
  return canAddMoreDragonPongMelds(state, 3)
}

function compatibleSmallThreeDragons(state: HandState): boolean {
  if (!withinStandardMeldBudget(state) || !withinTileBudget(state)) return false
  if (state.meldCount > 3) return false
  if (state.pair?.length === 2 && !isDragon(state.pair[0])) return false
  if (state.pair?.length === 2 && state.pair[0] !== state.pair[1]) return false
  if (state.pair?.length === 2 && isDragon(state.pair[0])) {
    const pairDragon = state.pair[0]
    if (state.melds.some((meld) => isPongOrKong(meld) && meld.tiles[0] === pairDragon)) return false
  }
  return canAddMoreDragonPongMelds(state, 2)
}

function compatibleBlessings(state: HandState): boolean {
  return state.openMeldCount < 2
}

function compatibleLimitHonorHands(state: HandState, patternId: string): boolean {
  switch (patternId) {
    case 'big-three-dragons':
      return compatibleBigThreeDragons(state)
    case 'small-three-dragons':
      return compatibleSmallThreeDragons(state)
    case 'big-four-winds':
      return compatibleBigFourWinds(state)
    case 'small-four-winds':
      return compatibleSmallFourWinds(state)
    default:
      return true
  }
}

const COMPATIBILITY_CHECKS: Record<string, (state: HandState) => boolean> = {
  'thirteen-orphans': compatibleThirteenOrphans,
  'seven-pairs': compatibleSevenPairs,
  'all-triplets': compatibleAllTriplets,
  'all-sequences': compatibleAllSequences,
  'pure-flush': compatiblePureFlush,
  'mixed-flush': compatibleMixedFlush,
  'nine-gates': compatibleNineGates,
  'concealed-hand': compatibleConcealedHand,
  'four-concealed-triplets': compatibleFourConcealedTriplets,
  'four-kongs': compatibleFourKongs,
  'three-kongs': compatibleThreeKongs,
  'all-honors': compatibleAllHonors,
  'all-terminals': compatibleAllTerminals,
  'mixed-terminals': compatibleMixedTerminals,
  'big-three-dragons': (state) => compatibleLimitHonorHands(state, 'big-three-dragons'),
  'small-three-dragons': (state) => compatibleLimitHonorHands(state, 'small-three-dragons'),
  'big-four-winds': (state) => compatibleLimitHonorHands(state, 'big-four-winds'),
  'small-four-winds': (state) => compatibleLimitHonorHands(state, 'small-four-winds'),
  'blessing-of-heaven': compatibleBlessings,
  'blessing-of-earth': compatibleBlessings,
  'blessing-of-man': compatibleBlessings,
}

export function isPatternCompatible(input: HandScoringInput, patternId: string): boolean {
  const state = buildHandState(input)
  const check = COMPATIBILITY_CHECKS[patternId]

  if (!withinTileBudget(state)) return false
  if (patternId !== 'seven-pairs' && patternId !== 'thirteen-orphans' && !withinStandardMeldBudget(state)) {
    return false
  }

  if (check) return check(state)

  if (state.hasOpenMeld && (patternId === 'four-concealed-triplets' || patternId === 'nine-gates')) {
    return false
  }

  return true
}
