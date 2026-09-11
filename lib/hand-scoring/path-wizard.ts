import type { MahjongTileId } from '@/components/MahjongTile'
import type { ScoringRules } from '@/lib/scoring-rules'
import { calculateFan } from './calculate-fan'
import { isPatternCompatible, ORPHAN_TILES } from './pattern-compatibility'
import { fanToNumber } from './parse-fan'
import { patternsForCalculator, type ScoringPattern } from './patterns'
import {
  isDragon,
  isHonor,
  isTerminal,
  isWind,
  numberedSuitsInHand,
  parseTile,
  type NumberedSuit,
} from './tile-utils'
import type { HandScoringInput, Meld, Wind } from './types'

export type PathWizardState = {
  tiles: MahjongTileId[]
  openMelds: Meld[]
  flowers: MahjongTileId[]
  seatWind: Wind
  roundWind: Wind
  includeNonTraditional: boolean
}

export type MinFanPath = {
  id: string
  title: string
  fan: number | 'limit'
  description: string
  currentFan: number
  potentialFan: number
  fanGap: number
  alreadyMatched: boolean
}

export type TileClass = 'useful' | 'clear-drop' | 'neutral'

export type ClassifiedTile = {
  id: MahjongTileId
  index: number
  classification: TileClass
}

export type SetCandidate = {
  key: string
  tiles: MahjongTileId[]
  kind: 'pong' | 'kong' | 'chow'
}

function countTiles(tiles: MahjongTileId[]): Map<MahjongTileId, number> {
  const counts = new Map<MahjongTileId, number>()
  for (const tile of tiles) counts.set(tile, (counts.get(tile) ?? 0) + 1)
  return counts
}

/** Remove one occurrence of each meld tile from the bag (multiset). */
export function subtractMeldsFromTiles(tiles: MahjongTileId[], melds: Meld[]): MahjongTileId[] {
  const remaining = countTiles(tiles)
  for (const meld of melds) {
    for (const tile of meld.tiles) {
      const next = (remaining.get(tile) ?? 0) - 1
      if (next <= 0) remaining.delete(tile)
      else remaining.set(tile, next)
    }
  }
  const out: MahjongTileId[] = []
  for (const [tile, count] of remaining) {
    for (let i = 0; i < count; i += 1) out.push(tile)
  }
  return out
}

export function meldsFitInTiles(tiles: MahjongTileId[], melds: Meld[]): boolean {
  const remaining = countTiles(tiles)
  for (const meld of melds) {
    for (const tile of meld.tiles) {
      const next = (remaining.get(tile) ?? 0) - 1
      if (next < 0) return false
      if (next === 0) remaining.delete(tile)
      else remaining.set(tile, next)
    }
  }
  return true
}

export function buildWizardInput(state: PathWizardState): HandScoringInput {
  const openMelds = state.openMelds.map((meld) => ({ ...meld, concealed: false }))
  const looseTiles = subtractMeldsFromTiles(state.tiles, openMelds)
  return {
    seatWind: state.seatWind,
    roundWind: state.roundWind,
    flowers: state.flowers,
    melds: openMelds,
    looseTiles,
    bonuses: new Set(),
    includeNonTraditional: state.includeNonTraditional,
  }
}

/**
 * Compatibility for the chase list uses locked open melds + flowers only.
 * Loose tiles are ignored here so patterns stay choosable until the player
 * commits locks — clear-drop highlighting then tells them what to discard.
 */
export function buildChaseCompatibilityInput(state: PathWizardState): HandScoringInput {
  const openMelds = state.openMelds.map((meld) => ({ ...meld, concealed: false }))
  return {
    seatWind: state.seatWind,
    roundWind: state.roundWind,
    flowers: state.flowers,
    melds: openMelds,
    looseTiles: [],
    bonuses: new Set(),
    includeNonTraditional: state.includeNonTraditional,
  }
}

export function listMinFanPaths(state: PathWizardState, rules: ScoringRules): MinFanPath[] {
  const scoredInput = buildWizardInput(state)
  const compatibilityInput = buildChaseCompatibilityInput(state)
  const current = calculateFan(scoredInput, rules)
  const matchedIds = new Set(current.patterns.map((p) => p.id))
  const allowed = patternsForCalculator(state.includeNonTraditional).filter((p) => !p.manualOnly)

  const paths: MinFanPath[] = []

  for (const pattern of allowed) {
    const alreadyMatched = matchedIds.has(pattern.id)
    if (!alreadyMatched && !isPatternCompatible(compatibilityInput, pattern.id)) continue

    const addedFan = pattern.fan === 'limit' ? rules.maxFan : fanToNumber(pattern.fan, rules.maxFan)
    const potentialFan = alreadyMatched
      ? current.totalFan
      : Math.min(rules.maxFan, current.totalFan + addedFan)
    const fanGap = Math.max(0, rules.minFan - potentialFan)

    paths.push({
      id: pattern.id,
      title: pattern.title,
      fan: pattern.fan,
      description: pattern.description,
      currentFan: current.totalFan,
      potentialFan,
      fanGap,
      alreadyMatched,
    })
  }

  return paths.sort((a, b) => {
    if (a.alreadyMatched !== b.alreadyMatched) return a.alreadyMatched ? -1 : 1
    if (a.fanGap !== b.fanGap) return a.fanGap - b.fanGap
    return fanToNumber(b.fan, rules.maxFan) - fanToNumber(a.fan, rules.maxFan)
  })
}

function dominantNumberedSuit(tiles: MahjongTileId[]): NumberedSuit | null {
  const counts: Record<NumberedSuit, number> = { character: 0, bamboo: 0, circle: 0 }
  for (const tile of tiles) {
    const parsed = parseTile(tile)
    if (parsed.kind === 'numbered') counts[parsed.suit] += 1
  }
  let best: NumberedSuit | null = null
  let bestCount = 0
  for (const suit of ['character', 'bamboo', 'circle'] as const) {
    if (counts[suit] > bestCount) {
      best = suit
      bestCount = counts[suit]
    }
  }
  return bestCount > 0 ? best : null
}

/** Prefer the numbered suit already committed in open melds; fall back to bag majority. */
export function targetNumberedSuit(allTiles: MahjongTileId[], openMelds: Meld[] = []): NumberedSuit | null {
  const lockedTiles = openMelds.flatMap((meld) => meld.tiles)
  const lockedSuit = dominantNumberedSuit(lockedTiles)
  if (lockedSuit) return lockedSuit
  return dominantNumberedSuit(allTiles)
}

function tileUsefulForPattern(
  tile: MahjongTileId,
  patternId: string,
  allTiles: MahjongTileId[],
  openMelds: Meld[] = [],
): boolean {
  const parsed = parseTile(tile)
  const suit = targetNumberedSuit(allTiles, openMelds)

  switch (patternId) {
    case 'pure-flush':
    case 'nine-gates':
      return parsed.kind === 'numbered' && (suit == null || parsed.suit === suit)
    case 'mixed-flush':
      if (isHonor(tile)) return true
      return parsed.kind === 'numbered' && (suit == null || parsed.suit === suit)
    case 'thirteen-orphans':
      return ORPHAN_TILES.includes(tile)
    case 'all-honors':
      return isHonor(tile)
    case 'all-terminals':
      return isTerminal(tile)
    case 'mixed-terminals':
      return isTerminal(tile) || isHonor(tile)
    case 'all-sequences':
    case 'pure-straight':
    case 'mixed-triple-sequence':
    case 'two-identical-sequences':
    case 'three-identical-sequences':
    case 'four-identical-sequences':
      return parsed.kind === 'numbered'
    case 'big-three-dragons':
    case 'small-three-dragons':
    case 'dragon-triplet':
      return isDragon(tile)
    case 'big-four-winds':
    case 'small-four-winds':
    case 'round-wind':
    case 'seat-wind':
      return isWind(tile)
    case 'all-triplets':
    case 'four-concealed-triplets':
    case 'three-kongs':
    case 'four-kongs':
    case 'seven-pairs':
      return parsed.kind !== 'flower'
    default:
      return parsed.kind !== 'flower'
  }
}

export function classifyTilesForPaths(
  looseTiles: MahjongTileId[],
  paths: MinFanPath[],
  focusIds: string[],
  allTiles: MahjongTileId[],
  openMelds: Meld[] = [],
): ClassifiedTile[] {
  // Highlighting requires an explicit target pattern — otherwise stay neutral.
  if (focusIds.length === 0) {
    return looseTiles.map((id, index) => ({ id, index, classification: 'neutral' as const }))
  }

  const active = paths.filter((path) => focusIds.includes(path.id))
  if (active.length === 0) {
    return looseTiles.map((id, index) => ({ id, index, classification: 'neutral' as const }))
  }

  return looseTiles.map((id, index) => {
    const usefulToTarget = active.some((path) => tileUsefulForPattern(id, path.id, allTiles, openMelds))
    return {
      id,
      index,
      classification: usefulToTarget ? 'useful' : 'clear-drop',
    }
  })
}

export function suggestSetCandidates(tiles: MahjongTileId[]): SetCandidate[] {
  const counts = countTiles(tiles)
  const candidates: SetCandidate[] = []

  for (const [tile, count] of counts) {
    if (count >= 4) {
      candidates.push({ key: `kong:${tile}`, tiles: [tile, tile, tile, tile], kind: 'kong' })
    }
    if (count >= 3) {
      candidates.push({ key: `pong:${tile}`, tiles: [tile, tile, tile], kind: 'pong' })
    }
  }

  for (const suit of ['character', 'bamboo', 'circle'] as const) {
    const prefix = suit === 'character' ? 'c' : suit === 'bamboo' ? 'b' : 'o'
    for (let rank = 1; rank <= 7; rank += 1) {
      const a = `${prefix}${rank}` as MahjongTileId
      const b = `${prefix}${rank + 1}` as MahjongTileId
      const c = `${prefix}${rank + 2}` as MahjongTileId
      if ((counts.get(a) ?? 0) > 0 && (counts.get(b) ?? 0) > 0 && (counts.get(c) ?? 0) > 0) {
        candidates.push({ key: `chow:${a}-${c}`, tiles: [a, b, c], kind: 'chow' })
      }
    }
  }

  return candidates
}

export function wizardProjectedFan(state: PathWizardState, rules: ScoringRules) {
  const result = calculateFan(buildWizardInput(state), rules)
  return {
    totalFan: result.totalFan,
    rawFan: result.rawFan,
    meetsMinFan: result.meetsMinFan,
    gap: Math.max(0, rules.minFan - result.totalFan),
    patterns: result.patterns,
  }
}

export function patternById(id: string): ScoringPattern | undefined {
  return patternsForCalculator(true).find((p) => p.id === id)
}

export function suitsInTiles(tiles: MahjongTileId[]) {
  return numberedSuitsInHand(tiles)
}
