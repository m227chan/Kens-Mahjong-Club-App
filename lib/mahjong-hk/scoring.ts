import { DRAGON_TILES, WIND_TILES, type HkRules } from '@/lib/mahjong-hk/rules/hk-classical-v1'
import type { HandState, Meld, WinContext } from '@/lib/mahjong-hk/state'
import { BASE_TILE_IDS, isDragon, isHonor, isWind, tileSuit, type BaseTileId } from '@/lib/mahjong-hk/tiles'
import { isWinningHand, type StandardDecomposition, type WinningShape } from '@/lib/mahjong-hk/hand-solver'

export interface FanPattern {
  id: string
  label: string
  fan: number
}

export interface ScoredWin {
  valid: boolean
  shape?: WinningShape
  fan: number
  rawFan: number
  meetsMinimum: boolean
  patterns: FanPattern[]
  decomposition?: StandardDecomposition
}

const LABELS: Record<string, string> = {
  self_draw: 'Self draw', concealed_hand: 'Concealed hand', all_chows: 'All chows', all_pongs: 'All pongs',
  mixed_one_suit: 'Mixed one suit', pure_one_suit: 'Pure one suit', all_honors: 'All honors',
  dragon_pong: 'Dragon pong', seat_wind_pong: 'Seat wind pong', round_wind_pong: 'Round wind pong',
  small_dragons: 'Small dragons', big_dragons: 'Big dragons', small_winds: 'Small winds', big_winds: 'Big winds',
  seven_pairs: 'Seven pairs', thirteen_orphans: 'Thirteen orphans', flower: 'Seat flower/season',
  all_flowers: 'All four flowers', all_seasons: 'All four seasons',
}

function pattern(id: string, rules: HkRules, multiplier = 1): FanPattern | null {
  const fan = rules.patternFan[id] * multiplier
  return fan ? { id, label: LABELS[id] ?? id, fan } : null
}

function pongTiles(melds: readonly Meld[]): BaseTileId[] {
  return melds.filter((meld) => meld.kind === 'pong' || meld.kind === 'kong').map((meld) => meld.tiles[0])
}

function scoreDecomposition(hand: HandState, decomposition: StandardDecomposition, context: WinContext, rules: HkRules): FanPattern[] {
  const patterns: FanPattern[] = []
  const add = (value: FanPattern | null) => { if (value) patterns.push(value) }
  const melds = decomposition.melds
  const pongs = pongTiles(melds)
  const allTiles = [...BASE_TILE_IDS.flatMap((tile, index) => Array.from({ length: hand.concealed[index] }, () => tile)), ...hand.melds.flatMap((meld) => meld.tiles)]
  const suits = new Set(allTiles.filter((tile) => !isHonor(tile)).map(tileSuit))
  const containsHonors = allTiles.some(isHonor)

  if (context.winType === 'self_draw' || context.winType === 'replacement_draw') add(pattern('self_draw', rules))
  if (hand.melds.every((meld) => !meld.exposed)) add(pattern('concealed_hand', rules))
  if (melds.every((meld) => meld.kind === 'chow') && !isHonor(decomposition.pair)) add(pattern('all_chows', rules))
  if (melds.every((meld) => meld.kind === 'pong' || meld.kind === 'kong')) add(pattern('all_pongs', rules))
  if (allTiles.every(isHonor)) add(pattern('all_honors', rules))
  else if (suits.size === 1 && containsHonors) add(pattern('mixed_one_suit', rules))
  else if (suits.size === 1 && !containsHonors) add(pattern('pure_one_suit', rules))

  const dragonPongs = pongs.filter(isDragon)
  const windPongs = pongs.filter(isWind)
  if (dragonPongs.length === 3) add(pattern('big_dragons', rules))
  else if (dragonPongs.length === 2 && isDragon(decomposition.pair)) add(pattern('small_dragons', rules))
  else if (dragonPongs.length) add(pattern('dragon_pong', rules, dragonPongs.length))

  if (windPongs.length === 4) add(pattern('big_winds', rules))
  else if (windPongs.length === 3 && isWind(decomposition.pair)) add(pattern('small_winds', rules))
  else {
    if (pongs.includes(hand.seatWind)) add(pattern('seat_wind_pong', rules))
    if (hand.roundWind && pongs.includes(hand.roundWind)) add(pattern('round_wind_pong', rules))
  }
  return patterns
}

function bonusPatterns(hand: HandState, rules: HkRules): FanPattern[] {
  if (!rules.includeBonusTiles) return []
  const result: FanPattern[] = []
  const bonus = new Set(hand.bonusTiles)
  const allFlowers = ['flower_plum', 'flower_orchid', 'flower_chrysanthemum', 'flower_bamboo'].every((tile) => bonus.has(tile as never))
  const allSeasons = ['season_spring', 'season_summer', 'season_autumn', 'season_winter'].every((tile) => bonus.has(tile as never))
  const add = (value: FanPattern | null) => { if (value) result.push(value) }
  if (allFlowers) add(pattern('all_flowers', rules))
  if (allSeasons) add(pattern('all_seasons', rules))
  const completeSets = (allFlowers ? 4 : 0) + (allSeasons ? 4 : 0)
  const matched = rules.bonusSeatMap[hand.seatWind].filter((tile) => bonus.has(tile)).length
  add(pattern('flower', rules, Math.max(0, matched - completeSets)))
  return result
}

function finish(patterns: FanPattern[], shape: WinningShape, rules: HkRules, decomposition?: StandardDecomposition): ScoredWin {
  const rawFan = patterns.reduce((total, item) => total + item.fan, 0)
  const fan = Math.min(rules.fanCap, rawFan)
  return { valid: true, shape, fan, rawFan, meetsMinimum: fan >= rules.minimumFan, patterns, decomposition }
}

export function scoreWin(hand: HandState, context: WinContext, rules: HkRules): ScoredWin {
  const result = isWinningHand(hand, rules)
  if (!result) return { valid: false, fan: 0, rawFan: 0, meetsMinimum: false, patterns: [] }
  const bonuses = bonusPatterns(hand, rules)
  if (result.shape === 'thirteen_orphans') return finish([pattern('thirteen_orphans', rules)!, ...bonuses], result.shape, rules)
  if (result.shape === 'seven_pairs') {
    const base = [pattern('seven_pairs', rules)!, ...bonuses]
    if (context.winType === 'self_draw' || context.winType === 'replacement_draw') base.push(pattern('self_draw', rules)!)
    return finish(base, result.shape, rules)
  }
  return result.decompositions
    .map((decomposition) => finish([...scoreDecomposition(hand, decomposition, context, rules), ...bonuses], result.shape, rules, decomposition))
    .sort((a, b) => b.rawFan - a.rawFan)[0]
}

export function patternTiles(): { dragons: readonly BaseTileId[]; winds: readonly BaseTileId[] } {
  return { dragons: DRAGON_TILES, winds: WIND_TILES }
}

