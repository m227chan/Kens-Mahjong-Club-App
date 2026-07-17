import { describe, expect, it } from 'vitest'

import { deficiency, effectiveTiles, enumerateWaits, handFromTiles, isWinningHand } from '@/lib/mahjong-hk/hand-solver'
import { legalActions } from '@/lib/mahjong-hk/legal-actions'
import { HK_CLASSICAL_V1 } from '@/lib/mahjong-hk/rules/hk-classical-v1'
import { scoreWin } from '@/lib/mahjong-hk/scoring'
import type { HandState, Meld, ObservedGameState } from '@/lib/mahjong-hk/state'
import { BASE_TILE_INDEX, countsFromTiles, type BaseTileId, type BonusTileId } from '@/lib/mahjong-hk/tiles'
import { validateObservedState } from '@/lib/mahjong-hk/validation'

const emptySeats = <T,>(): [T[], T[], T[], T[]] => [[], [], [], []]

function hand(tiles: BaseTileId[], partial: Partial<Omit<HandState, 'concealed'>> = {}): HandState {
  return handFromTiles(tiles, {
    melds: partial.melds ?? [],
    bonusTiles: partial.bonusTiles ?? [],
    seatWind: partial.seatWind ?? 'east',
    roundWind: partial.roundWind ?? 'east',
    drawnTile: partial.drawnTile,
  })
}

function state(currentHand: HandState, userSeat: 0 | 1 | 2 | 3 = 0): ObservedGameState {
  return {
    hand: currentHand,
    discardsBySeat: emptySeats(),
    exposedMeldsBySeat: emptySeats(),
    bonusTilesBySeat: emptySeats(),
    activeSeat: userSeat,
    userSeat,
    tilesRemainingEstimate: 70,
    lastEvent: null,
    observationConfidence: 1,
    rulesVersion: HK_CLASSICAL_V1.id,
    version: 1,
  }
}

describe('Classical Hong Kong hand solver', () => {
  it('recognizes a standard four-meld-and-pair hand', () => {
    const result = isWinningHand(hand([
      'characters_1', 'characters_2', 'characters_3',
      'bamboo_1', 'bamboo_2', 'bamboo_3',
      'dots_1', 'dots_2', 'dots_3',
      'east', 'east', 'east', 'red_dragon', 'red_dragon',
    ]), HK_CLASSICAL_V1)
    expect(result?.shape).toBe('standard')
    expect(result?.decompositions.length).toBeGreaterThan(0)
  })

  it('recognizes seven pairs and thirteen orphans', () => {
    expect(isWinningHand(hand([
      'characters_1', 'characters_1', 'characters_3', 'characters_3',
      'bamboo_2', 'bamboo_2', 'bamboo_9', 'bamboo_9',
      'dots_4', 'dots_4', 'east', 'east', 'red_dragon', 'red_dragon',
    ]), HK_CLASSICAL_V1)?.shape).toBe('seven_pairs')

    expect(isWinningHand(hand([
      'characters_1', 'characters_9', 'bamboo_1', 'bamboo_9', 'dots_1', 'dots_9',
      'east', 'south', 'west', 'north', 'red_dragon', 'green_dragon', 'white_dragon', 'east',
    ]), HK_CLASSICAL_V1)?.shape).toBe('thirteen_orphans')
  })

  it('returns -1 for complete, 0 for ready, and the correct wait', () => {
    const ready = hand([
      'characters_1', 'characters_2', 'characters_3',
      'bamboo_1', 'bamboo_2', 'bamboo_3',
      'dots_1', 'dots_2', 'dots_3',
      'east', 'east', 'east', 'red_dragon',
    ])
    expect(deficiency(ready, HK_CLASSICAL_V1)).toBe(0)
    expect(enumerateWaits(ready, HK_CLASSICAL_V1)).toContain('red_dragon')
    const completed = hand([...Array.from({ length: 13 }, (_, i) => ([
      'characters_1', 'characters_2', 'characters_3', 'bamboo_1', 'bamboo_2', 'bamboo_3',
      'dots_1', 'dots_2', 'dots_3', 'east', 'east', 'east', 'red_dragon',
    ] as BaseTileId[])[i]), 'red_dragon'])
    expect(deficiency(completed, HK_CLASSICAL_V1)).toBe(-1)
  })

  it('counts only live effective copies', () => {
    const ready = hand([
      'characters_1', 'characters_2', 'characters_3', 'bamboo_1', 'bamboo_2', 'bamboo_3',
      'dots_1', 'dots_2', 'dots_3', 'east', 'east', 'east', 'red_dragon',
    ])
    const visible = {
      discardsBySeat: [['red_dragon'], [], [], []] as BaseTileId[][],
      exposedMeldsBySeat: emptySeats<Meld>(),
      bonusTilesBySeat: emptySeats<BonusTileId>(),
    }
    expect(effectiveTiles(ready, HK_CLASSICAL_V1, visible).find((item) => item.tile === 'red_dragon')?.remaining).toBe(2)
  })
})

describe('Classical Hong Kong legality and scoring', () => {
  const restingTiles: BaseTileId[] = [
    'characters_1', 'characters_2', 'characters_4', 'characters_5',
    'bamboo_1', 'bamboo_2', 'bamboo_3', 'dots_1', 'dots_2', 'dots_3',
    'east', 'east', 'red_dragon',
  ]

  it('offers chow only for a known discard from the previous seat', () => {
    const current = state(hand(restingTiles), 0)
    const eligible = legalActions(current, { type: 'DISCARD_DETECTED', tile: 'characters_3', sourceSeat: 3 }, HK_CLASSICAL_V1)
    const unknown = legalActions(current, { type: 'DISCARD_DETECTED', tile: 'characters_3', sourceSeat: null }, HK_CLASSICAL_V1)
    expect(eligible.some((action) => action.type === 'chow')).toBe(true)
    expect(unknown.some((action) => action.type === 'chow')).toBe(false)
  })

  it('offers pong and exposed kong only with enough concealed copies', () => {
    const pongState = state(hand([...restingTiles.slice(0, 11), 'red_dragon', 'red_dragon']))
    const pong = legalActions(pongState, { type: 'DISCARD_DETECTED', tile: 'red_dragon', sourceSeat: 2 }, HK_CLASSICAL_V1)
    expect(pong).toContainEqual({ type: 'pong', tile: 'red_dragon' })
    expect(pong.some((action) => action.type === 'kong')).toBe(false)

    pongState.hand.concealed[BASE_TILE_INDEX.red_dragon] = 3
    pongState.hand.concealed[BASE_TILE_INDEX.characters_1] -= 1
    const kong = legalActions(pongState, { type: 'DISCARD_DETECTED', tile: 'red_dragon', sourceSeat: 2 }, HK_CLASSICAL_V1)
    expect(kong).toContainEqual({ type: 'kong', tile: 'red_dragon', kind: 'exposed' })
  })

  it('scores an all-pongs hand and enforces the configured minimum', () => {
    const winning = hand([
      'characters_1', 'characters_1', 'characters_1',
      'bamboo_2', 'bamboo_2', 'bamboo_2',
      'dots_3', 'dots_3', 'dots_3',
      'east', 'east', 'east', 'red_dragon', 'red_dragon',
    ])
    const scored = scoreWin(winning, { winType: 'discard' }, HK_CLASSICAL_V1)
    expect(scored.valid).toBe(true)
    expect(scored.patterns.map((item) => item.id)).toContain('all_pongs')
    expect(scored.meetsMinimum).toBe(true)
  })

  it('suppresses advice when tile conservation is impossible', () => {
    const current = state(hand(restingTiles))
    current.discardsBySeat[1] = ['east', 'east', 'east']
    expect(validateObservedState(current).valid).toBe(false)
    expect(legalActions(current, { type: 'DISCARD_DETECTED', tile: 'dots_9', sourceSeat: 1 }, HK_CLASSICAL_V1)).toEqual([])
  })

  it('round-trips count vectors without exceeding four copies', () => {
    const tiles = restingTiles
    const counts = countsFromTiles(tiles)
    expect(Array.from(counts).every((count) => count >= 0 && count <= 4)).toBe(true)
    expect(Array.from(counts).reduce((sum, count) => sum + count, 0)).toBe(tiles.length)
  })
})
