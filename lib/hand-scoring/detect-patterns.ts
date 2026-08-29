import type { MahjongTileId } from '@/components/MahjongTile'
import type { HandScoringInput } from './types'
import { isPatternCompatible, ORPHAN_TILES } from './pattern-compatibility'
import {
  allHandTiles,
  countIdenticalChows,
  isChow,
  isDragon,
  isHonor,
  isKong,
  isPongOrKong,
  isTerminal,
  isWind,
  numberedSuitsInHand,
  parseTile,
  seatFlowerRank,
} from './tile-utils'

const ORPHAN_TILES_LOCAL = ORPHAN_TILES

function detectFlowerPatterns(input: HandScoringInput): string[] {
  const { flowers, seatWind } = input
  const count = flowers.length
  if (count === 0) return ['no-flowers']
  if (count >= 8) return ['8-flowers']
  if (count >= 7) return ['7-flowers']

  const seasons = flowers.filter((f) => ['f1', 'f2', 'f3', 'f4'].includes(f))
  const blooms = flowers.filter((f) => ['f5', 'f6', 'f7', 'f8'].includes(f))
  const hasFullSeasonSet = seasons.length === 4
  const hasFullBloomSet = blooms.length === 4
  const seatRank = seatFlowerRank(seatWind)
  const seatSeason = `f${seatRank}` as MahjongTileId
  const seatBloom = `f${seatRank + 4}` as MahjongTileId
  const hasSeatSeason = flowers.includes(seatSeason)
  const hasSeatBloom = flowers.includes(seatBloom)
  const hasBothSeatFlowers = hasSeatSeason && hasSeatBloom
  const hasSeatFlower = hasSeatSeason || hasSeatBloom

  const matched: string[] = []
  if (hasFullSeasonSet || hasFullBloomSet) matched.push('set-of-flowers')
  if (hasBothSeatFlowers) matched.push('double-flower')
  else if (hasSeatFlower) matched.push('seat-flower')
  return matched
}

function detectFlushPatterns(tiles: MahjongTileId[]): string[] {
  const suits = numberedSuitsInHand(tiles)
  const hasHonors = tiles.some(isHonor)
  const hasNumbered = suits.size > 0

  if (suits.size === 1 && !hasHonors) return ['pure-flush']
  if (suits.size === 1 && hasHonors && hasNumbered) return ['mixed-flush']
  return []
}

function detectTripletStructure(input: HandScoringInput): string[] {
  const { melds, pair } = input
  if (melds.length !== 4 || !pair?.length) return []

  const allPongs = melds.every(isPongOrKong)
  const allChows = melds.every(isChow)
  const allConcealed = melds.every((m) => m.concealed)

  const matched: string[] = []
  if (allPongs) matched.push('all-triplets')
  if (allChows) matched.push('all-sequences')
  if (allPongs && allConcealed) matched.push('four-concealed-triplets')

  const kongCount = melds.filter(isKong).length
  if (kongCount === 4) matched.push('four-kongs')
  if (kongCount === 3) matched.push('three-kongs')

  return matched
}

function detectHonorPatterns(input: HandScoringInput): string[] {
  const { melds, pair, seatWind, roundWind } = input
  const matched: string[] = []

  const dragonPongs = new Set<'red' | 'green' | 'white'>()
  const windPongs = new Set<MahjongTileId>()
  let dragonPair: 'red' | 'green' | 'white' | null = null
  let windPair: MahjongTileId | null = null

  for (const meld of melds) {
    if (!isPongOrKong(meld)) continue
    const tile = meld.tiles[0]
    if (isDragon(tile)) dragonPongs.add(tile as 'red' | 'green' | 'white')
    if (isWind(tile)) windPongs.add(tile)
  }

  if (pair?.length === 2) {
    const tile = pair[0]
    if (isDragon(tile) && pair[1] === tile) dragonPair = tile as 'red' | 'green' | 'white'
    if (isWind(tile) && pair[1] === tile) windPair = tile
  }

  for (const meld of melds) {
    if (!isPongOrKong(meld)) continue
    const tile = meld.tiles[0]
    if (isDragon(tile)) matched.push('dragon-triplet')
  }

  if (windPongs.has(roundWind)) matched.push('round-wind')
  if (windPongs.has(seatWind)) matched.push('seat-wind')

  if (dragonPongs.size === 2 && dragonPair) matched.push('small-three-dragons')
  if (dragonPongs.size === 3) matched.push('big-three-dragons')

  if (windPongs.size === 3 && windPair) matched.push('small-four-winds')
  if (windPongs.size === 4) matched.push('big-four-winds')

  return matched
}

function detectTerminalPatterns(tiles: MahjongTileId[]): string[] {
  if (tiles.length === 0) return []
  const allTerminalOrHonor = tiles.every((t) => isTerminal(t) || isHonor(t))
  const allTerminalOnly = tiles.every(isTerminal)
  const matched: string[] = []
  if (allTerminalOrHonor) matched.push('mixed-terminals')
  if (allTerminalOnly) matched.push('all-terminals')
  return matched
}

function detectAllHonors(tiles: MahjongTileId[]): string[] {
  if (tiles.length === 0) return []
  return tiles.every(isHonor) ? ['all-honors'] : []
}

function detectSevenPairs(input: HandScoringInput): string[] {
  const { melds, pair } = input
  const groups = [...melds.map((m) => m.tiles), ...(pair ? [pair] : [])]
  if (groups.length !== 7) return []
  if (!groups.every((g) => g.length === 2 && g[0] === g[1])) return []
  return ['seven-pairs']
}

function detectSequencePatterns(input: HandScoringInput): string[] {
  const { melds } = input
  const matched: string[] = []
  const identical = countIdenticalChows(melds)
  if (identical >= 4) matched.push('four-identical-sequences')
  else if (identical >= 3) matched.push('three-identical-sequences')
  else if (identical >= 2) matched.push('two-identical-sequences')

  const chows = melds.filter(isChow)
  if (chows.length >= 3) {
    const numberedChows = chows.map((m) => m.tiles.map(parseTile)).filter((p) => p.every((t) => t.kind === 'numbered'))
    for (const suit of ['character', 'bamboo', 'circle'] as const) {
      const suitChows = numberedChows.filter((p) => p[0].kind === 'numbered' && p[0].suit === suit)
      if (suitChows.length >= 3) {
        const starts = suitChows.map((p) =>
          (p as { kind: 'numbered'; rank: number }[]).map((t) => t.rank).sort((a, b) => a - b)[0],
        )
        if (starts.includes(1) && starts.includes(4) && starts.includes(7)) {
          matched.push('pure-straight')
          break
        }
      }
    }

    if (chows.length >= 3) {
      const byRank = new Map<string, number>()
      for (const chow of chows) {
        const parsed = chow.tiles.map(parseTile) as { kind: 'numbered'; suit: string; rank: number }[]
        if (!parsed.every((p) => p.kind === 'numbered')) continue
        const ranks = parsed.map((p) => p.rank).sort((a, b) => a - b).join('-')
        const key = ranks
        byRank.set(key, (byRank.get(key) ?? 0) + 1)
      }
      for (const [, count] of byRank) {
        if (count >= 3) {
          matched.push('mixed-triple-sequence')
          break
        }
      }
    }
  }

  return matched
}

function detectThirteenOrphans(tiles: MahjongTileId[]): string[] {
  if (tiles.length !== 14) return []
  const counts = new Map<MahjongTileId, number>()
  for (const t of tiles) counts.set(t, (counts.get(t) ?? 0) + 1)
  let pairFound = false
  for (const orphan of ORPHAN_TILES_LOCAL) {
    const c = counts.get(orphan) ?? 0
    if (c === 0) return []
    if (c === 2) {
      if (pairFound) return []
      pairFound = true
    } else if (c !== 1) return []
  }
  for (const [tile, count] of counts) {
    if (!ORPHAN_TILES_LOCAL.includes(tile)) return []
    if (count > 2) return []
  }
  return ['thirteen-orphans']
}

function detectNineGates(input: HandScoringInput): string[] {
  const { melds, pair } = input
  if (!melds.every((m) => m.concealed)) return []
  const tiles = allHandTiles(input)
  if (tiles.length !== 14) return []

  for (const suit of ['character', 'bamboo', 'circle'] as const) {
    const suitTiles = tiles.filter((t) => {
      const p = parseTile(t)
      return p.kind === 'numbered' && p.suit === suit
    })
    if (suitTiles.length !== 14) continue
    const counts = new Map<number, number>()
    for (const t of suitTiles) {
      const p = parseTile(t) as { kind: 'numbered'; rank: number }
      counts.set(p.rank, (counts.get(p.rank) ?? 0) + 1)
    }
    const c1 = counts.get(1) ?? 0
    const c9 = counts.get(9) ?? 0
    if (c1 < 3 || c9 < 3) continue
    let valid = true
    for (let rank = 2; rank <= 8; rank++) {
      if ((counts.get(rank) ?? 0) < 1) valid = false
    }
    if (valid) return ['nine-gates']
  }

  void pair
  return []
}

function detectConcealedHand(input: HandScoringInput): string[] {
  if (input.melds.length === 0) return []
  return input.melds.every((m) => m.concealed) ? ['concealed-hand'] : []
}

export function detectPatterns(input: HandScoringInput): string[] {
  const tiles = allHandTiles(input)
  const matched: string[] = []

  matched.push(...detectFlowerPatterns(input))

  if (tiles.length > 0) {
    matched.push(...detectFlushPatterns(tiles))
    matched.push(...detectTripletStructure(input))
    matched.push(...detectHonorPatterns(input))
    matched.push(...detectTerminalPatterns(tiles))
    matched.push(...detectAllHonors(tiles))
    matched.push(...detectSevenPairs(input))
    matched.push(...detectSequencePatterns(input))
    matched.push(...detectThirteenOrphans(tiles))
    matched.push(...detectNineGates(input))
    matched.push(...detectConcealedHand(input))
  }

  matched.push(...input.bonuses)

  return matched
}

export { flowerTileIds } from '@/components/MahjongTile'
export { isPatternCompatible } from './pattern-compatibility'
