import type { MahjongTileId } from '@/components/MahjongTile'
import { isDragon, isPongOrKong, isWind } from './tile-utils'
import type { HandScoringInput, MatchedPattern, Meld } from './types'

const DRAGON_LABELS = {
  red: 'Red',
  green: 'Green',
  white: 'White',
} as const

const WIND_LABELS = {
  east: 'East',
  south: 'South',
  west: 'West',
  north: 'North',
} as const

function collectDragonPongs(melds: Meld[]): Array<keyof typeof DRAGON_LABELS> {
  const dragons: Array<keyof typeof DRAGON_LABELS> = []
  for (const meld of melds) {
    if (!isPongOrKong(meld)) continue
    const tile = meld.tiles[0]
    if (isDragon(tile)) dragons.push(tile as keyof typeof DRAGON_LABELS)
  }
  return dragons
}

export function enrichMatchedPatternTitles(
  input: HandScoringInput,
  patterns: MatchedPattern[],
): MatchedPattern[] {
  const dragonOrder = collectDragonPongs(input.melds)
  let dragonIndex = 0

  return patterns.map((pattern) => {
    if (pattern.id === 'dragon-triplet') {
      const dragon = dragonOrder[dragonIndex]
      dragonIndex += 1
      if (!dragon) return pattern
      return { ...pattern, title: `Dragon Triplet (${DRAGON_LABELS[dragon]})` }
    }

    if (pattern.id === 'round-wind') {
      return { ...pattern, title: `Wind Triplet (${WIND_LABELS[input.roundWind]})` }
    }

    if (pattern.id === 'seat-wind') {
      return { ...pattern, title: `Wind Triplet (${WIND_LABELS[input.seatWind]})` }
    }

    return pattern
  })
}

export function dragonTripletTitle(dragon: MahjongTileId): string {
  if (!isDragon(dragon)) return 'Dragon Triplet'
  return `Dragon Triplet (${DRAGON_LABELS[dragon as keyof typeof DRAGON_LABELS]})`
}

export function windTripletTitle(wind: MahjongTileId): string {
  if (!isWind(wind)) return 'Wind Triplet'
  return `Wind Triplet (${WIND_LABELS[wind]})`
}
