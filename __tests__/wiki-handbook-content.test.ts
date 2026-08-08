import { describe, expect, it } from 'vitest'
import {
  WIKI_HAND_SECTIONS,
  WikiHand,
} from '@/app/wiki/wiki-content'
import { MahjongTileId } from '@/components/MahjongTile'

// Expected handbook fan values map
const EXPECTED_HANDBOOK_VALUES: Record<string, string> = {
  'No Flowers': '1 fan',
  'Seat Flower': '1 fan',
  'Set of Flowers': '2 fan',
  '7 Flowers': '3 fan',
  '8 Flowers': '8 fan',
  'Self Draw': '1 fan',
  'Concealed Hand': '1 fan',
  'Win on Final Tile': '1 fan',
  'After a Kong': '1 fan',
  'After Multiple Kongs': '8 fan',
  'Robbing a Kong': '1 fan',
  'Mixed Flush': '3 fan',
  'Pure Flush': '7 fan',
  'Dragon Triplet': '1 fan',
  'Round Wind': '1 fan',
  'Seat Wind': '1 fan',
  'Small Three Dragons': '5 fan',
  'Big Three Dragons': '8 fan',
  'Small Four Winds': '6 fan',
  'Big Four Winds': 'Limit',
  'All Honors': '10 fan',
  'All Triplets': '3 fan',
  'Four Concealed Triplets': '8 fan',
  'Mixed Terminals': '4 fan',
  'All Terminals': 'Limit',
  'Four Kongs': 'Limit',
  'All Sequences': '1 fan',
  'Thirteen Orphans': 'Limit',
  'Nine Gates': 'Limit',
  'Blessing of Heaven': 'Limit',
  'Blessing of Earth': 'Limit',
  'Blessing of Man': 'Limit',
  'Seven Pairs': '3 fan',
  'Three Kongs': '3 fan',
  'Pure Straight': '3 fan',
  'Mixed Triple Sequence': '3 fan',
  'Two Identical Sequences': '1 fan',
  'Three Identical Sequences': '3 fan',
  'Four Identical Sequences': 'Limit',
}

function parseTile(id: MahjongTileId): { suit: string; rank?: number } {
  if (id.startsWith('c') && id.length === 2 && !isNaN(Number(id[1]))) {
    return { suit: 'character', rank: Number(id[1]) }
  }
  if (id.startsWith('b') && id.length === 2 && !isNaN(Number(id[1]))) {
    return { suit: 'bamboo', rank: Number(id[1]) }
  }
  if (id.startsWith('o') && id.length === 2 && !isNaN(Number(id[1]))) {
    return { suit: 'circle', rank: Number(id[1]) }
  }
  return { suit: id }
}

function isChow(group: MahjongTileId[]): boolean {
  if (group.length !== 3) return false
  const parsed = group.map(parseTile)
  const suit = parsed[0].suit
  if (suit !== 'character' && suit !== 'bamboo' && suit !== 'circle') return false
  if (!parsed.every((p) => p.suit === suit && p.rank !== undefined)) return false
  const ranks = parsed.map((p) => p.rank!).sort((a, b) => a - b)
  return ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1
}

function isPong(group: MahjongTileId[]): boolean {
  return group.length === 3 && group.every((tile) => tile === group[0])
}

function isKong(group: MahjongTileId[]): boolean {
  return group.length === 4 && group.every((tile) => tile === group[0])
}

function isPair(group: MahjongTileId[]): boolean {
  return group.length === 2 && group[0] === group[1]
}

describe('Mahjong Handbook Content & Structural Rules', () => {
  const allHands: WikiHand[] = WIKI_HAND_SECTIONS.flatMap((section) => section.hands)

  it('contains every handbook hand with the exact specified fan/Limit value', () => {
    Object.entries(EXPECTED_HANDBOOK_VALUES).forEach(([title, expectedValue]) => {
      const hand = allHands.find((h) => h.title === title)
      expect(hand, `Missing hand: ${title}`).toBeDefined()
      expect(hand?.value, `Incorrect fan value for ${title}`).toBe(expectedValue)
    })
  })

  it('validates every standard hand example structure', () => {
    const standardHands = allHands.filter((h) => h.type === 'standard')

    standardHands.forEach((hand) => {
      expect(hand.groups, `${hand.title} must have groups`).toBeDefined()
      const groups = hand.groups!

      // exactly 5 groups
      expect(groups.length, `${hand.title} must have exactly 5 groups`).toBe(5)

      // first 4 groups are valid chows, pongs, or kongs
      let numKongs = 0
      for (let i = 0; i < 4; i++) {
        const group = groups[i]
        const validSet = isChow(group) || isPong(group) || isKong(group)
        expect(validSet, `${hand.title} group ${i + 1} (${group.join(',')}) must be a valid chow, pong, or kong`).toBe(true)
        if (isKong(group)) numKongs++
      }

      // last group is an identical pair
      const pairGroup = groups[4]
      expect(isPair(pairGroup), `${hand.title} group 5 (${pairGroup.join(',')}) must be an identical pair`).toBe(true)

      // no tile appears more than 4 times
      const tileCounts: Record<string, number> = {}
      const flatTiles = groups.flat()
      flatTiles.forEach((tile) => {
        tileCounts[tile] = (tileCounts[tile] || 0) + 1
        expect(tileCounts[tile], `${hand.title} has tile ${tile} more than 4 times`).toBeLessThanOrEqual(4)
      })

      // physical tile count = 14 + numberOfKongs
      expect(flatTiles.length, `${hand.title} physical tile count mismatch`).toBe(14 + numKongs)
    })
  })

  it('verifies physical tile counts for Three Kongs (17) and Four Kongs (18)', () => {
    const threeKongs = allHands.find((h) => h.title === 'Three Kongs')!
    expect(threeKongs.groups!.flat().length).toBe(17)

    const fourKongs = allHands.find((h) => h.title === 'Four Kongs')!
    expect(fourKongs.groups!.flat().length).toBe(18)
  })

  it('verifies Seven Pairs structure (7 identical pairs = 14 tiles)', () => {
    const sevenPairs = allHands.find((h) => h.title === 'Seven Pairs')!
    expect(sevenPairs.groups).toBeDefined()
    expect(sevenPairs.groups!.length).toBe(7)
    sevenPairs.groups!.forEach((pair) => {
      expect(isPair(pair)).toBe(true)
    })
    expect(sevenPairs.groups!.flat().length).toBe(14)
  })

  it('verifies Thirteen Orphans pattern (14 tiles with 13 unique terminals/honors + 1 duplicate)', () => {
    const orphans = allHands.find((h) => h.title === 'Thirteen Orphans')!
    expect(orphans.tiles).toBeDefined()
    expect(orphans.tiles!.length).toBe(14)

    const required13: MahjongTileId[] = [
      'c1', 'c9', 'b1', 'b9', 'o1', 'o9',
      'east', 'south', 'west', 'north', 'red', 'green', 'white',
    ]

    required13.forEach((reqTile) => {
      expect(orphans.tiles!.includes(reqTile), `Thirteen Orphans missing ${reqTile}`).toBe(true)
    })
  })

  it('verifies Nine Gates pattern (1112345678999 + 1 extra in same suit = 14 tiles)', () => {
    const nineGates = allHands.find((h) => h.title === 'Nine Gates')!
    expect(nineGates.tiles).toBeDefined()
    expect(nineGates.tiles!.length).toBe(14)
    // 1112345678999 in characters + extra c1
    const expected = ['c1', 'c1', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c9', 'c9', 'c1']
    expect(nineGates.tiles).toEqual(expected)
  })

  it('verifies condition-only hands have no tile examples', () => {
    const blessings = ['Blessing of Heaven', 'Blessing of Earth', 'Blessing of Man']
    blessings.forEach((title) => {
      const blessing = allHands.find((h) => h.title === title)!
      expect(blessing.type).toBe('condition-only')
      expect(blessing.tiles).toBeUndefined()
      expect(blessing.groups).toBeUndefined()
    })
  })
})
