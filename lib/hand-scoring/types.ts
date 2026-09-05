import type { MahjongTileId } from '@/components/MahjongTile'

export type Wind = 'east' | 'south' | 'west' | 'north'

export type Meld = {
  tiles: MahjongTileId[]
  concealed: boolean
}

export type HandScoringInput = {
  seatWind: Wind
  roundWind: Wind
  flowers: MahjongTileId[]
  melds: Meld[]
  pair?: MahjongTileId[]
  bonuses: Set<string>
  includeNonTraditional: boolean
}

export type PatternCategory =
  | 'flower'
  | 'winning-method'
  | 'hand'
  | 'special'
  | 'limit'

export type MatchedPattern = {
  id: string
  title: string
  fan: number | 'limit'
  category: PatternCategory
}

export type FanCalculationResult = {
  patterns: MatchedPattern[]
  totalFan: number
  rawFan: number
  hasLimitPattern: boolean
  isCapped: boolean
  isLimit: boolean
  meetsMinFan: boolean
}

export type PatternSuggestion = {
  id: string
  title: string
  fan: number | 'limit'
  fanGap: number | null
  compatible: boolean
  manualOnly: boolean
}
