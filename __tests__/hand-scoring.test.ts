import { describe, expect, it } from 'vitest'
import { calculateFan } from '@/lib/hand-scoring/calculate-fan'
import { describeTotalFan } from '@/lib/hand-scoring/describe-total-fan'
import { totalFanDisplay } from '@/lib/hand-scoring/total-fan-display'
import { detectPatterns } from '@/lib/hand-scoring/detect-patterns'
import { parseFanValue } from '@/lib/hand-scoring/parse-fan'
import { SCORING_PATTERNS } from '@/lib/hand-scoring/patterns'
import { isCompleteHand, COMPLETE_HAND_TILE_COUNT } from '@/lib/hand-scoring/hand-complete'
import { flatTilesToMeldsAndPair } from '@/lib/hand-scoring/flat-hand-input'
import { isPatternCompatible } from '@/lib/hand-scoring/pattern-compatibility'
import { suggestPatterns } from '@/lib/hand-scoring/suggest-patterns'
import type { HandScoringInput, Meld } from '@/lib/hand-scoring/types'
import { DEFAULT_SCORING_RULES } from '@/lib/scoring-rules'

function baseInput(overrides: Partial<HandScoringInput> = {}): HandScoringInput {
  return {
    seatWind: 'south',
    roundWind: 'east',
    flowers: [],
    melds: [],
    bonuses: new Set(),
    includeNonTraditional: false,
    ...overrides,
  }
}

function pong(tile: Meld['tiles'][0], concealed = false): Meld {
  return { tiles: [tile, tile, tile], concealed }
}

function kong(tile: Meld['tiles'][0], concealed = false): Meld {
  return { tiles: [tile, tile, tile, tile], concealed }
}

function chow(a: Meld['tiles'][0], b: Meld['tiles'][0], c: Meld['tiles'][0], concealed = false): Meld {
  return { tiles: [a, b, c], concealed }
}

describe('hand scoring engine', () => {
  it('parses fan values from handbook strings', () => {
    expect(parseFanValue('3 fan')).toBe(3)
    expect(parseFanValue('Limit')).toBe('limit')
  })

  it('builds scoring patterns from wiki content', () => {
    expect(SCORING_PATTERNS.length).toBeGreaterThanOrEqual(40)
    expect(SCORING_PATTERNS.find((p) => p.id === 'pure-flush')?.fan).toBe(7)
  })

  it('stacks Pure Flush and All Triplets for 10 fan', () => {
    const input = baseInput({
      flowers: ['f1'],
      melds: [pong('b2'), pong('b3'), pong('b4'), pong('b5')],
      pair: ['b1', 'b1'],
    })
    const detected = detectPatterns(input)
    expect(detected).toContain('pure-flush')
    expect(detected).toContain('all-triplets')

    const result = calculateFan(input, DEFAULT_SCORING_RULES)
    expect(result.totalFan).toBe(10)
    expect(result.patterns.map((p) => p.id)).toEqual(
      expect.arrayContaining(['pure-flush', 'all-triplets']),
    )
  })

  it('stacks Mixed Flush, All Triplets, Self Draw, and Seat Wind', () => {
    const input = baseInput({
      flowers: ['f1'],
      seatWind: 'south',
      melds: [
        pong('south'),
        pong('c2'),
        pong('c3'),
        pong('c4'),
      ],
      pair: ['c1', 'c1'],
      bonuses: new Set(['self-draw']),
    })
    const result = calculateFan(input, DEFAULT_SCORING_RULES)
    expect(result.totalFan).toBe(8)
    expect(result.patterns.map((p) => p.id)).toEqual(
      expect.arrayContaining(['mixed-flush', 'all-triplets', 'self-draw', 'seat-wind']),
    )
  })

  it('stacks each dragon triplet for 1 fan', () => {
    const input = baseInput({
      flowers: [],
      melds: [pong('c1'), pong('b3'), pong('red'), pong('green')],
      pair: ['c7', 'c7'],
    })
    const result = calculateFan(input, DEFAULT_SCORING_RULES)
    expect(result.patterns.filter((p) => p.id === 'dragon-triplet')).toHaveLength(2)
    expect(result.patterns.filter((p) => p.id === 'dragon-triplet').map((p) => p.title)).toEqual([
      'Dragon Triplet (Red)',
      'Dragon Triplet (Green)',
    ])
    expect(result.totalFan).toBe(6)
  })

  it('detects a complete fourteen-tile hand excluding flowers', () => {
    const complete = baseInput({
      melds: [pong('c1'), pong('b3'), pong('red'), pong('green')],
      pair: ['c7', 'c7'],
    })
    expect(isCompleteHand(complete)).toBe(true)

    const partial = baseInput({
      melds: [pong('c1'), pong('b3'), pong('red')],
      pair: ['c7', 'c7'],
    })
    expect(isCompleteHand(partial)).toBe(false)
    expect(COMPLETE_HAND_TILE_COUNT).toBe(14)
  })

  it('excludes individual dragon triplets when Small Three Dragons applies', () => {
    const input = baseInput({
      flowers: ['f1'],
      melds: [pong('red'), pong('green'), chow('c2', 'c3', 'c4'), chow('b5', 'b6', 'b7')],
      pair: ['white', 'white'],
    })
    const result = calculateFan(input, DEFAULT_SCORING_RULES)
    expect(result.patterns.map((p) => p.id)).toContain('small-three-dragons')
    expect(result.patterns.map((p) => p.id)).not.toContain('dragon-triplet')
    expect(result.totalFan).toBe(5)
  })

  it('caps limit hands at club max fan', () => {
    const input = baseInput({
      melds: [pong('east'), pong('south'), pong('west'), pong('north')],
      pair: ['c1', 'c1'],
      bonuses: new Set(),
    })
    const result = calculateFan(input, DEFAULT_SCORING_RULES)
    expect(result.hasLimitPattern).toBe(true)
    expect(result.isLimit).toBe(true)
    expect(result.isCapped).toBe(false)
    expect(result.totalFan).toBe(DEFAULT_SCORING_RULES.maxFan)
    expect(result.rawFan).toBe(DEFAULT_SCORING_RULES.maxFan)
  })

  it('caps stacked fan at club max and keeps the raw total', () => {
    const rules = { ...DEFAULT_SCORING_RULES, maxFan: 8 }
    const input = baseInput({
      flowers: ['f1'],
      melds: [pong('b2'), pong('b3'), pong('b4'), pong('b5')],
      pair: ['b1', 'b1'],
    })
    const result = calculateFan(input, rules)
    expect(result.rawFan).toBe(10)
    expect(result.totalFan).toBe(8)
    expect(result.isCapped).toBe(true)
    expect(result.isLimit).toBe(true)
  })

  it('detects seat flower and no flowers', () => {
    expect(detectPatterns(baseInput({ flowers: [] }))).toContain('no-flowers')
    expect(detectPatterns(baseInput({ seatWind: 'south', flowers: ['f2'] }))).toContain('seat-flower')
    expect(detectPatterns(baseInput({ flowers: ['f1', 'f2', 'f3', 'f4'] }))).toContain('set-of-flowers')
  })

  it('detects double flower when both seat flowers are selected', () => {
    const input = baseInput({ seatWind: 'east', flowers: ['f1', 'f5'] })
    const result = calculateFan(input, DEFAULT_SCORING_RULES)
    expect(result.patterns.map((p) => p.id)).toContain('double-flower')
    expect(result.patterns.map((p) => p.id)).not.toContain('seat-flower')
    expect(result.totalFan).toBe(2)
  })

  it('filters suggestions by minimum fan', () => {
    const input = baseInput({
      melds: [pong('c2'), chow('c3', 'c4', 'c5')],
      pair: ['c1', 'c1'],
    })
    const suggestions = suggestPatterns(input, DEFAULT_SCORING_RULES)
    const meetsMin = suggestions.filter((s) => s.compatible && (s.fanGap === 0 || s.fanGap === null))
    expect(meetsMin.length).toBeGreaterThan(0)
  })

  it('rejects winning paths that conflict with committed melds', () => {
    const withOpenChow = baseInput({
      melds: [chow('c2', 'c3', 'c4', false)],
      pair: ['c1', 'c1'],
    })
    expect(isPatternCompatible(withOpenChow, 'thirteen-orphans')).toBe(false)
    expect(isPatternCompatible(withOpenChow, 'all-triplets')).toBe(false)
    expect(suggestPatterns(withOpenChow, DEFAULT_SCORING_RULES).some((s) => s.id === 'thirteen-orphans')).toBe(false)

    const withPong = baseInput({
      melds: [pong('b2')],
    })
    expect(isPatternCompatible(withPong, 'all-sequences')).toBe(false)
    expect(isPatternCompatible(withPong, 'seven-pairs')).toBe(false)

    const withMiddleTile = baseInput({
      melds: [pong('c5')],
      pair: ['c5', 'c5'],
    })
    expect(isPatternCompatible(withMiddleTile, 'all-terminals')).toBe(false)
    expect(isPatternCompatible(withMiddleTile, 'thirteen-orphans')).toBe(false)
  })

  it('rejects big four winds when committed melds cannot reach four wind pongs', () => {
    const withOpenCharacterPong = baseInput({
      melds: [pong('c2', false)],
    })
    expect(isPatternCompatible(withOpenCharacterPong, 'big-four-winds')).toBe(false)
    expect(suggestPatterns(withOpenCharacterPong, DEFAULT_SCORING_RULES).some((s) => s.id === 'big-four-winds')).toBe(false)

    const withWindPlusCharacterPong = baseInput({
      melds: [pong('east', false), pong('c2')],
    })
    expect(isPatternCompatible(withWindPlusCharacterPong, 'big-four-winds')).toBe(false)

    const withOneWindPong = baseInput({
      melds: [pong('east', false)],
    })
    expect(isPatternCompatible(withOneWindPong, 'big-four-winds')).toBe(true)

    const withFourMeldsOnlyThreeWindsPossible = baseInput({
      melds: [pong('east'), pong('south'), pong('west'), pong('c2')],
    })
    expect(isPatternCompatible(withFourMeldsOnlyThreeWindsPossible, 'big-four-winds')).toBe(false)
  })

  it('rejects blessings when multiple melds are open', () => {
    const oneOpen = baseInput({
      melds: [pong('east', true), pong('south', false)],
    })
    expect(isPatternCompatible(oneOpen, 'blessing-of-heaven')).toBe(true)

    const twoOpen = baseInput({
      melds: [pong('east', false), pong('south', false)],
    })
    expect(isPatternCompatible(twoOpen, 'blessing-of-heaven')).toBe(false)
    expect(isPatternCompatible(twoOpen, 'blessing-of-earth')).toBe(false)
    expect(isPatternCompatible(twoOpen, 'blessing-of-man')).toBe(false)
    expect(suggestPatterns(twoOpen, DEFAULT_SCORING_RULES).some((s) => s.id === 'blessing-of-heaven')).toBe(false)
  })

  it('respects non-traditional toggle', () => {
    const input = baseInput({
      melds: [
        { tiles: ['c1', 'c1'], concealed: true },
        { tiles: ['c2', 'c2'], concealed: true },
        { tiles: ['c3', 'c3'], concealed: true },
        { tiles: ['b4', 'b4'], concealed: true },
        { tiles: ['b5', 'b5'], concealed: true },
        { tiles: ['o6', 'o6'], concealed: true },
      ],
      pair: ['south', 'south'],
      includeNonTraditional: false,
    })
    expect(calculateFan(input, DEFAULT_SCORING_RULES).patterns.map((p) => p.id)).not.toContain('seven-pairs')

    const withTraditional = calculateFan({ ...input, includeNonTraditional: true }, DEFAULT_SCORING_RULES)
    expect(withTraditional.patterns.map((p) => p.id)).toContain('seven-pairs')
  })

  it('reports meetsMinFan against club rules', () => {
    const low = calculateFan(baseInput({ bonuses: new Set(['self-draw']), flowers: [] }), {
      ...DEFAULT_SCORING_RULES,
      minFan: 3,
    })
    expect(low.meetsMinFan).toBe(false)

    const high = calculateFan(
      baseInput({
        melds: [pong('b2'), pong('b3'), pong('b4'), pong('b5')],
        pair: ['b1', 'b1'],
      }),
      DEFAULT_SCORING_RULES,
    )
    expect(high.meetsMinFan).toBe(true)
  })

  it('describes stacked fan totals for the explanation panel', () => {
    const input = baseInput({
      flowers: ['f1'],
      melds: [pong('b2'), pong('b3'), pong('b4'), pong('b5')],
      pair: ['b1', 'b1'],
    })
    const result = calculateFan(input, DEFAULT_SCORING_RULES)
    const explanation = describeTotalFan(result, DEFAULT_SCORING_RULES)

    expect(explanation.rows.at(-1)?.value).toBe('7 + 3 = 10 fan')
    expect(explanation.notes.some((note) => note.includes('exclusion rules'))).toBe(true)
    expect(explanation.notes.some((note) => note.includes('Meets the 3+ fan minimum'))).toBe(true)
  })

  it('formats capped totals with a limit label and raw fan in brackets', () => {
    const rules = { ...DEFAULT_SCORING_RULES, maxFan: 8 }
    const input = baseInput({
      flowers: ['f1'],
      melds: [pong('b2'), pong('b3'), pong('b4'), pong('b5')],
      pair: ['b1', 'b1'],
    })
    const result = calculateFan(input, rules)
    expect(totalFanDisplay(result, rules)).toEqual({
      main: '8+',
      limitLabel: 'Limit (10)',
    })
  })

  it('converts special-flat tiles into engine input for Thirteen Orphans', () => {
    const flatTiles = [
      'c1', 'c9', 'b1', 'b9', 'o1', 'o9',
      'east', 'south', 'west', 'north', 'red', 'green', 'white', 'c1',
    ] as const
    const { melds, pair } = flatTilesToMeldsAndPair([...flatTiles])
    const input = baseInput({ melds, pair })
    const result = calculateFan(input, DEFAULT_SCORING_RULES)
    expect(result.patterns.map((p) => p.id)).toContain('thirteen-orphans')
    expect(isCompleteHand(input)).toBe(true)
  })

  it('converts special-flat tiles into engine input for Nine Gates', () => {
    const flatTiles = [
      'c1', 'c1', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c9', 'c9', 'c1',
    ] as const
    const { melds, pair } = flatTilesToMeldsAndPair([...flatTiles])
    const input = baseInput({ melds, pair })
    const result = calculateFan(input, DEFAULT_SCORING_RULES)
    expect(result.patterns.map((p) => p.id)).toContain('nine-gates')
    expect(isCompleteHand(input)).toBe(true)
  })

  it('converts special-flat tiles into engine input for Pure Straight', () => {
    const flatTiles = [
      'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'b1', 'b2', 'b3', 'o1', 'o1',
    ] as const
    const { melds, pair } = flatTilesToMeldsAndPair([...flatTiles])
    const input = baseInput({ melds, pair, includeNonTraditional: true })
    const result = calculateFan(input, DEFAULT_SCORING_RULES)
    expect(result.patterns.map((p) => p.id)).toContain('pure-straight')
    expect(isCompleteHand(input)).toBe(true)
  })
})
