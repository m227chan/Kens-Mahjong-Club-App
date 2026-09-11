import { describe, expect, it } from 'vitest'
import {
  classifyTilesForPaths,
  listMinFanPaths,
  subtractMeldsFromTiles,
  wizardProjectedFan,
  type PathWizardState,
} from '@/lib/hand-scoring/path-wizard'
import { DEFAULT_SCORING_RULES } from '@/lib/scoring-rules'
import type { Meld } from '@/lib/hand-scoring/types'

function openPong(tile: Meld['tiles'][0]): Meld {
  return { tiles: [tile, tile, tile], concealed: false }
}

function baseState(overrides: Partial<PathWizardState> = {}): PathWizardState {
  return {
    tiles: [],
    openMelds: [],
    flowers: [],
    seatWind: 'east',
    roundWind: 'east',
    includeNonTraditional: true,
    ...overrides,
  }
}

describe('path wizard', () => {
  it('excludes manual-only blessings from min-fan paths', () => {
    const paths = listMinFanPaths(baseState({ tiles: ['c1', 'c2', 'c3'] }), DEFAULT_SCORING_RULES)
    expect(paths.some((path) => path.id.startsWith('blessing-of-'))).toBe(false)
  })

  it('keeps all-triplets after open dragon pongs and drops thirteen orphans', () => {
    const state = baseState({
      tiles: ['red', 'red', 'red', 'green', 'green', 'green', 'c2', 'c5', 'b3'],
      openMelds: [openPong('red'), openPong('green')],
    })
    const paths = listMinFanPaths(state, DEFAULT_SCORING_RULES)
    expect(paths.some((path) => path.id === 'all-triplets')).toBe(true)
    expect(paths.some((path) => path.id === 'big-three-dragons')).toBe(true)
    expect(paths.some((path) => path.id === 'thirteen-orphans')).toBe(false)
  })

  it('marks clear-drop tiles when focusing pure flush after an open bamboo pong', () => {
    const state = baseState({
      tiles: ['b2', 'b2', 'b2', 'b4', 'b5', 'b6', 'east'],
      openMelds: [openPong('b2')],
    })
    const paths = listMinFanPaths(state, DEFAULT_SCORING_RULES)
    expect(paths.some((path) => path.id === 'pure-flush')).toBe(true)
    expect(paths.some((path) => path.id === 'mixed-flush')).toBe(true)

    const loose = subtractMeldsFromTiles(state.tiles, state.openMelds)
    const forPure = classifyTilesForPaths(loose, paths, ['pure-flush'], state.tiles, state.openMelds)
    expect(forPure.find((tile) => tile.id === 'east')?.classification).toBe('clear-drop')
    expect(forPure.find((tile) => tile.id === 'b4')?.classification).toBe('useful')

    const forMixed = classifyTilesForPaths(loose, paths, ['mixed-flush'], state.tiles, state.openMelds)
    expect(forMixed.find((tile) => tile.id === 'east')?.classification).toBe('useful')
    expect(forMixed.find((tile) => tile.id === 'b4')?.classification).toBe('useful')
  })

  it('uses the locked open suit for mixed-flush clear drops even with more offsuit tiles', () => {
    const state = baseState({
      tiles: ['b2', 'b2', 'b2', 'c3', 'c5', 'c7', 'o4', 'east'],
      openMelds: [openPong('b2')],
    })
    const paths = listMinFanPaths(state, DEFAULT_SCORING_RULES)
    // Mixed flush is not compatible once offsuit tiles are present, but classification
    // for a focused mixed-flush target still treats bamboo + honors as keepers.
    const loose = subtractMeldsFromTiles(state.tiles, state.openMelds)
    const classified = classifyTilesForPaths(
      loose,
      [...paths, { id: 'mixed-flush', title: 'Mixed Flush', fan: 3, description: '', currentFan: 0, potentialFan: 3, fanGap: 0, alreadyMatched: false }],
      ['mixed-flush'],
      state.tiles,
      state.openMelds,
    )
    expect(classified.find((tile) => tile.id === 'east')?.classification).toBe('useful')
    expect(classified.find((tile) => tile.id === 'c3')?.classification).toBe('clear-drop')
    expect(classified.find((tile) => tile.id === 'o4')?.classification).toBe('clear-drop')
  })

  it('leaves tiles neutral until a target pattern is selected', () => {
    const state = baseState({
      tiles: ['b2', 'b2', 'b2', 'c3'],
      openMelds: [openPong('b2')],
    })
    const paths = listMinFanPaths(state, DEFAULT_SCORING_RULES)
    const loose = subtractMeldsFromTiles(state.tiles, state.openMelds)
    const classified = classifyTilesForPaths(loose, paths, [], state.tiles, state.openMelds)
    expect(classified.every((tile) => tile.classification === 'neutral')).toBe(true)
  })

  it('keeps thirteen orphans choosable with a middle tile, and marks that tile clear-drop', () => {
    const orphans = baseState({
      tiles: ['c1', 'c9', 'b1', 'b9', 'o1', 'east', 'red'],
    })
    expect(listMinFanPaths(orphans, DEFAULT_SCORING_RULES).some((path) => path.id === 'thirteen-orphans')).toBe(true)

    const withMiddle = baseState({
      tiles: ['c1', 'c9', 'b1', 'b9', 'o1', 'east', 'red', 'c5'],
    })
    const paths = listMinFanPaths(withMiddle, DEFAULT_SCORING_RULES)
    expect(paths.some((path) => path.id === 'thirteen-orphans')).toBe(true)

    const loose = subtractMeldsFromTiles(withMiddle.tiles, withMiddle.openMelds)
    const classified = classifyTilesForPaths(
      loose,
      paths,
      ['thirteen-orphans'],
      withMiddle.tiles,
      withMiddle.openMelds,
    )
    expect(classified.find((tile) => tile.id === 'c5')?.classification).toBe('clear-drop')
  })

  it('hides thirteen orphans after locking a middle-tile open meld', () => {
    const state = baseState({
      tiles: ['c5', 'c5', 'c5', 'c1', 'c9'],
      openMelds: [openPong('c5')],
    })
    expect(listMinFanPaths(state, DEFAULT_SCORING_RULES).some((path) => path.id === 'thirteen-orphans')).toBe(false)
  })

  it('lists flush paths before locks even when the bag has multiple suits', () => {
    const state = baseState({
      tiles: ['b2', 'b3', 'c5', 'o7', 'east'],
    })
    const paths = listMinFanPaths(state, DEFAULT_SCORING_RULES)
    expect(paths.some((path) => path.id === 'mixed-flush')).toBe(true)
    expect(paths.some((path) => path.id === 'pure-flush')).toBe(true)
    expect(paths.some((path) => path.id === 'all-triplets')).toBe(true)
  })

  it('hides pure flush after locking open melds of two numbered suits', () => {
    const state = baseState({
      tiles: ['b2', 'b2', 'b2', 'c5', 'c5', 'c5'],
      openMelds: [openPong('b2'), openPong('c5')],
    })
    const paths = listMinFanPaths(state, DEFAULT_SCORING_RULES)
    expect(paths.some((path) => path.id === 'pure-flush')).toBe(false)
    expect(paths.some((path) => path.id === 'mixed-flush')).toBe(false)
    expect(paths.some((path) => path.id === 'all-triplets')).toBe(true)
  })
})
