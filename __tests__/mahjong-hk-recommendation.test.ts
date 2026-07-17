import { describe, expect, it } from 'vitest'

import { probabilityAtLeastOne, SeededRandom, drawTileIndex } from '@/lib/mahjong-hk/belief-state'
import { handFromTiles } from '@/lib/mahjong-hk/hand-solver'
import { evaluateDiscards, recommendDiscard } from '@/lib/mahjong-hk/recommendation'
import { HK_CLASSICAL_V1 } from '@/lib/mahjong-hk/rules/hk-classical-v1'
import type { ObservedGameState } from '@/lib/mahjong-hk/state'
import type { BaseTileId } from '@/lib/mahjong-hk/tiles'

const tiles: BaseTileId[] = [
  'characters_1', 'characters_2', 'characters_3', 'characters_5', 'characters_6',
  'bamboo_1', 'bamboo_2', 'bamboo_3', 'dots_2', 'dots_3', 'dots_4',
  'east', 'east', 'red_dragon',
]

function state(): ObservedGameState {
  return {
    hand: handFromTiles(tiles, { melds: [], bonusTiles: [], seatWind: 'east', roundWind: 'east', drawnTile: 'red_dragon' }),
    discardsBySeat: [[], [], [], []],
    exposedMeldsBySeat: [[], [], [], []],
    bonusTilesBySeat: [[], [], [], []],
    activeSeat: 0,
    userSeat: 0,
    tilesRemainingEstimate: 40,
    lastEvent: { type: 'USER_DRAW_CONFIRMED', tile: 'red_dragon' },
    observationConfidence: 1,
    rulesVersion: HK_CLASSICAL_V1.id,
    version: 7,
  }
}

describe('belief-state probability helpers', () => {
  it('computes sampling-without-replacement probabilities', () => {
    expect(probabilityAtLeastOne(10, 2, 1)).toBeCloseTo(0.2)
    expect(probabilityAtLeastOne(10, 2, 2)).toBeCloseTo(1 - (8 / 10) * (7 / 9))
    expect(probabilityAtLeastOne(10, 0, 4)).toBe(0)
  })

  it('draws deterministically and consumes exactly one tile', () => {
    const firstCounts = new Uint8Array([2, 1])
    const secondCounts = new Uint8Array([2, 1])
    expect(drawTileIndex(firstCounts, new SeededRandom(42))).toBe(drawTileIndex(secondCounts, new SeededRandom(42)))
    expect(Array.from(firstCounts).reduce((sum, count) => sum + count, 0)).toBe(2)
  })
})

describe('discard recommendation', () => {
  it('is deterministic for a state, seed, and rollout budget', () => {
    const options = { rollouts: 32, ownDraws: 3, seed: 1234 }
    const first = recommendDiscard(state(), HK_CLASSICAL_V1, options)
    const second = recommendDiscard(state(), HK_CLASSICAL_V1, options)
    expect(first.action).toEqual(second.action)
    expect(first.alternatives.map((item) => item.winProbability.mean)).toEqual(
      second.alternatives.map((item) => item.winProbability.mean)
    )
    expect(first.stateVersion).toBe(7)
  })

  it('evaluates every distinct legal discard with bounded estimates', () => {
    const evaluations = evaluateDiscards(state(), HK_CLASSICAL_V1, { rollouts: 16, ownDraws: 2, seed: 99 })
    expect(evaluations.length).toBe(new Set(tiles).size)
    evaluations.forEach((evaluation) => {
      expect(evaluation.action.type).toBe('discard')
      expect(evaluation.winProbability.mean).toBeGreaterThanOrEqual(0)
      expect(evaluation.winProbability.mean).toBeLessThanOrEqual(1)
      expect(evaluation.improveNextDraw).toBeGreaterThanOrEqual(0)
      expect(evaluation.improveNextDraw).toBeLessThanOrEqual(1)
    })
  })
})
