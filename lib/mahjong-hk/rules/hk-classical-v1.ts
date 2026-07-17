import type { BaseTileId, BonusTileId } from '@/lib/mahjong-hk/tiles'

export type Wind = 'east' | 'south' | 'west' | 'north'

export interface HkRules {
  id: string
  displayName: string
  minimumFan: number
  fanCap: number
  includeBonusTiles: boolean
  allowSevenPairs: boolean
  allowThirteenOrphans: boolean
  chowFromPreviousSeatOnly: boolean
  patternFan: Readonly<Record<string, number>>
  bonusSeatMap: Readonly<Record<Wind, readonly BonusTileId[]>>
}

/**
 * Versioned, explicit starting profile for this app's current 3-fan/13-fan-cap
 * convention. Hand-pattern values remain isolated here so a club's verified
 * house rules can replace them without changing solver or camera code.
 */
export const HK_CLASSICAL_V1: HkRules = Object.freeze({
  id: 'hk-classical-v1',
  displayName: 'Classical Hong Kong (3 fan minimum)',
  minimumFan: 3,
  fanCap: 13,
  includeBonusTiles: true,
  allowSevenPairs: true,
  allowThirteenOrphans: true,
  chowFromPreviousSeatOnly: true,
  patternFan: Object.freeze({
    self_draw: 1,
    concealed_hand: 1,
    all_chows: 1,
    all_pongs: 3,
    mixed_one_suit: 3,
    pure_one_suit: 7,
    all_honors: 13,
    dragon_pong: 1,
    seat_wind_pong: 1,
    round_wind_pong: 1,
    small_dragons: 5,
    big_dragons: 8,
    small_winds: 6,
    big_winds: 13,
    seven_pairs: 4,
    thirteen_orphans: 13,
    flower: 1,
    all_flowers: 2,
    all_seasons: 2,
  }),
  bonusSeatMap: Object.freeze({
    east: ['flower_plum', 'season_spring'],
    south: ['flower_orchid', 'season_summer'],
    west: ['flower_chrysanthemum', 'season_autumn'],
    north: ['flower_bamboo', 'season_winter'],
  } satisfies Record<Wind, readonly BonusTileId[]>),
})

export const DRAGON_TILES: readonly BaseTileId[] = ['red_dragon', 'green_dragon', 'white_dragon']
export const WIND_TILES: readonly BaseTileId[] = ['east', 'south', 'west', 'north']
