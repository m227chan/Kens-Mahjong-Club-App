import { MahjongTileId } from '@/components/MahjongTile'

export type HandExampleType =
  | 'standard'       // 4 sets + 1 pair in groups
  | 'bonus'          // Flower bonus tiles
  | 'seven-pairs'    // 7 pairs in groups
  | 'special-flat'   // Thirteen Orphans, Nine Gates flat tiles
  | 'condition-only' // Blessings, winning methods with no tile pattern

export interface WikiHand {
  title: string
  value: string
  description: string
  type: HandExampleType
  groups?: MahjongTileId[][]
  tiles?: MahjongTileId[]
  note?: string
  nonTraditional?: boolean
}

export interface WikiHandSection {
  id: string
  heading: string
  description: string
  hands: WikiHand[]
}

export const HANDBOOK_FAN_TABLE = [
  { fan: 0, points: 1 },
  { fan: 1, points: 2 },
  { fan: 2, points: 4 },
  { fan: 3, points: 8 },
  { fan: 4, points: 16 },
  { fan: 5, points: 24 },
  { fan: 6, points: 32 },
  { fan: 7, points: 48 },
  { fan: 8, points: 64 },
  { fan: 9, points: 96 },
  { fan: 10, points: 128 },
  { fan: 11, points: 192 },
  { fan: 12, points: 256 },
  { fan: 13, points: 384 },
] as const

export const WIKI_NAV_SECTIONS = [
  { id: 'mahjong-basics', label: 'Mahjong basics' },
  { id: 'complete-tile-reference', label: 'Tile reference' },
  { id: 'scoring-guide', label: 'How scoring works' },
  { id: 'bonus-flowers', label: 'Flowers' },
  { id: 'winning-methods', label: 'Winning methods' },
  { id: 'suit-based-hands', label: 'Suit-based hands' },
  { id: 'honor-hands', label: 'Honor hands' },
  { id: 'triplet-hands', label: 'Triplet hands' },
  { id: 'sequence-hands', label: 'Sequence hands' },
  { id: 'special-hands', label: 'Special hands' },
  { id: 'non-traditional-hands', label: 'Non-traditional hands' },
]

export const WIKI_HAND_SECTIONS: WikiHandSection[] = [
  {
    heading: 'Flowers',
    id: 'bonus-flowers',
    description: 'Flower cards are bonus-tile examples, not part of the standard 14-tile hand structure.',
    hands: [
      {
        title: 'No Flowers',
        value: '1 fan',
        description: 'Have no flowers.',
        type: 'bonus',
        tiles: [],
      },
      {
        title: 'Seat Flower',
        value: '1 fan',
        description: 'Have a flower matching your seat: East=1, South=2, West=3, North=4.',
        type: 'bonus',
        tiles: ['f2', 'f6'],
        note: 'South seat example: Summer (2) or Orchid (6)',
      },
      {
        title: 'Set of Flowers',
        value: '2 fan',
        description: 'Have all 4 flowers from the same series.',
        type: 'bonus',
        tiles: ['f1', 'f2', 'f3', 'f4'],
        note: 'Seasons (1-4) or Flowers (1-4)',
      },
      {
        title: '7 Flowers',
        value: '3 fan',
        description: 'Draw 7 flowers; player has the option to win immediately.',
        type: 'bonus',
        tiles: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'],
      },
      {
        title: '8 Flowers',
        value: '8 fan',
        description: 'Draw all 8 flowers; player has the option to win immediately.',
        type: 'bonus',
        tiles: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'],
      },
    ],
  },
  {
    heading: 'Winning methods',
    id: 'winning-methods',
    description: 'These conditions add fan value based on how or when the winning tile is acquired.',
    hands: [
      { title: 'Self Draw', value: '1 fan', description: 'Draw the winning tile yourself.', type: 'condition-only' },
      { title: 'Concealed Hand', value: '1 fan', description: 'Win without calling sheung , pong, or kong; entire hand is concealed.', type: 'condition-only' },
      { title: 'Win on Final Tile', value: '1 fan', description: 'Win by drawing the final tile in the wall, or when another player discards the final tile.', type: 'condition-only' },
      { title: 'After a Kong', value: '1 fan', description: 'Win with the replacement tile after calling kong.', type: 'condition-only' },
      { title: 'After Multiple Kongs', value: '8 fan', description: 'Call kong multiple times in a row and win with the replacement tile.', type: 'condition-only' },
      { title: 'Robbing a Kong', value: '1 fan', description: 'Win using the tile another player adds to an open pong to make a kong.', type: 'condition-only' },
    ],
  },
  {
    heading: 'Suit-based hands',
    id: 'suit-based-hands',
    description: 'Hands made of tiles from specific suit combinations.',
    hands: [
      {
        title: 'Mixed Flush',
        value: '3 fan',
        description: 'Only tiles from one numbered suit plus honor tiles.',
        type: 'standard',
        groups: [
          ['c2', 'c3', 'c4'],
          ['c3', 'c4', 'c5'],
          ['c6', 'c7', 'c8'],
          ['c9', 'c9', 'c9'],
          ['east', 'east'],
        ],
      },
      {
        title: 'Pure Flush',
        value: '7 fan',
        description: 'Only tiles from one numbered suit.',
        type: 'standard',
        groups: [
          ['b2', 'b3', 'b4'],
          ['b3', 'b4', 'b5'],
          ['b6', 'b7', 'b8'],
          ['b9', 'b9', 'b9'],
          ['b1', 'b1'],
        ],
      },
    ],
  },
  {
    heading: 'Honor hands',
    id: 'honor-hands',
    description: 'Honor hands feature wind and dragon tiles.',
    hands: [
      {
        title: 'Dragon Triplet',
        value: '1 fan',
        description: 'A pong or kong of Red, Green, or White Dragon.',
        type: 'standard',
        groups: [
          ['red', 'red', 'red'],
          ['c2', 'c3', 'c4'],
          ['b5', 'b6', 'b7'],
          ['o1', 'o2', 'o3'],
          ['c1', 'c1'],
        ],
      },
      {
        title: 'Round Wind',
        value: '1 fan',
        description: 'A pong or kong of the wind matching the current round.',
        type: 'standard',
        groups: [
          ['east', 'east', 'east'],
          ['c4', 'c5', 'c6'],
          ['b3', 'b4', 'b5'],
          ['o2', 'o3', 'o4'],
          ['c1', 'c1'],
        ],
      },
      {
        title: 'Seat Wind',
        value: '1 fan',
        description: 'A pong or kong of the wind matching your assigned seat.',
        type: 'standard',
        groups: [
          ['south', 'south', 'south'],
          ['c4', 'c5', 'c6'],
          ['b3', 'b4', 'b5'],
          ['o2', 'o3', 'o4'],
          ['c1', 'c1'],
        ],
      },
      {
        title: 'Small Three Dragons',
        value: '5 fan',
        description: 'Pongs or kongs of two dragons plus a pair of the third. Do not also score the individual dragon triplets.',
        type: 'standard',
        groups: [
          ['red', 'red', 'red'],
          ['green', 'green', 'green'],
          ['c2', 'c3', 'c4'],
          ['b5', 'b6', 'b7'],
          ['white', 'white'],
        ],
      },
      {
        title: 'Big Three Dragons',
        value: '8 fan',
        description: 'Pongs or kongs of all three dragons. Do not also score the individual dragon triplets.',
        type: 'standard',
        groups: [
          ['red', 'red', 'red'],
          ['green', 'green', 'green'],
          ['white', 'white', 'white'],
          ['c2', 'c3', 'c4'],
          ['b5', 'b5'],
        ],
      },
      {
        title: 'Small Four Winds',
        value: '6 fan',
        description: 'Pongs or kongs of three winds plus a pair of the fourth. Do not also score the individual wind triplets or Mixed Flush.',
        type: 'standard',
        groups: [
          ['east', 'east', 'east'],
          ['south', 'south', 'south'],
          ['west', 'west', 'west'],
          ['c2', 'c3', 'c4'],
          ['north', 'north'],
        ],
      },
      {
        title: 'Big Four Winds',
        value: 'Limit',
        description: 'Pongs or kongs of all four winds, plus a pair.',
        type: 'standard',
        groups: [
          ['east', 'east', 'east'],
          ['south', 'south', 'south'],
          ['west', 'west', 'west'],
          ['north', 'north', 'north'],
          ['c1', 'c1'],
        ],
      },
      {
        title: 'All Honors',
        value: '10 fan',
        description: 'A complete hand made only from winds and dragons.',
        type: 'standard',
        groups: [
          ['east', 'east', 'east'],
          ['south', 'south', 'south'],
          ['red', 'red', 'red'],
          ['white', 'white', 'white'],
          ['green', 'green'],
        ],
      },
    ],
  },
  {
    heading: 'Triplet hands',
    id: 'triplet-hands',
    description: 'Hands built primarily from triplets (pongs) or kongs.',
    hands: [
      {
        title: 'All Triplets',
        value: '3 fan',
        description: 'Four pongs or kongs plus a pair. No sheungs.',
        type: 'standard',
        groups: [
          ['c1', 'c1', 'c1'],
          ['c2', 'c2', 'c2'],
          ['c3', 'c3', 'c3'],
          ['red', 'red', 'red'],
          ['b5', 'b5'],
        ],
      },
      {
        title: 'Four Concealed Triplets',
        value: '8 fan',
        description: 'Four pongs or kongs plus a pair, all concealed or self-drawn.',
        type: 'standard',
        groups: [
          ['b2', 'b2', 'b2'],
          ['b3', 'b3', 'b3'],
          ['b4', 'b4', 'b4'],
          ['o5', 'o5', 'o5'],
          ['c7', 'c7'],
        ],
      },
      {
        title: 'Mixed Terminals',
        value: '4 fan',
        description: 'A complete hand using only 1s, 9s, winds, and dragons.',
        type: 'standard',
        groups: [
          ['c1', 'c1', 'c1'],
          ['c9', 'c9', 'c9'],
          ['red', 'red', 'red'],
          ['east', 'east', 'east'],
          ['b1', 'b1'],
        ],
      },
      {
        title: 'All Terminals',
        value: 'Limit',
        description: 'A complete hand using only 1s and 9s.',
        type: 'standard',
        groups: [
          ['c1', 'c1', 'c1'],
          ['c9', 'c9', 'c9'],
          ['b1', 'b1', 'b1'],
          ['b9', 'b9', 'b9'],
          ['o1', 'o1'],
        ],
      },
      {
        title: 'Four Kongs',
        value: 'Limit',
        description: 'All four sets are kongs, plus a pair.',
        type: 'standard',
        groups: [
          ['red', 'red', 'red', 'red'],
          ['green', 'green', 'green', 'green'],
          ['east', 'east', 'east', 'east'],
          ['south', 'south', 'south', 'south'],
          ['c2', 'c2'],
        ],
      },
    ],
  },
  {
    heading: 'Sequence hands',
    id: 'sequence-hands',
    description: 'Hands made of sequence sets (sheungs).',
    hands: [
      {
        title: 'All Sequences',
        value: '1 fan',
        description: 'Four sheungs plus a pair. No pongs or kongs.',
        type: 'standard',
        groups: [
          ['c2', 'c3', 'c4'],
          ['b2', 'b3', 'b4'],
          ['o2', 'o3', 'o4'],
          ['c7', 'c8', 'c9'],
          ['south', 'south'],
        ],
      },
    ],
  },
  {
    heading: 'Special hands',
    id: 'special-hands',
    description: 'Unique structural hands or timing conditions.',
    hands: [
      {
        title: 'Thirteen Orphans',
        value: 'Limit',
        description: 'One 1 and one 9 from each suit, all seven honor tiles, plus one duplicate of any of those 13 tile types.',
        type: 'special-flat',
        tiles: ['c1', 'c9', 'b1', 'b9', 'o1', 'o9', 'east', 'south', 'west', 'north', 'red', 'green', 'white', 'c1'],
      },
      {
        title: 'Nine Gates',
        value: 'Limit',
        description: 'A concealed 1112345678999 pattern in one suit, completed by any 1–9 tile from that same suit.',
        type: 'special-flat',
        tiles: ['c1', 'c1', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c9', 'c9', 'c1'],
      },
      { title: 'Blessing of Heaven', value: 'Limit', description: 'Win on the first turn as dealer.', type: 'condition-only' },
      { title: 'Blessing of Earth', value: 'Limit', description: "Win on the dealer's first discard.", type: 'condition-only' },
      { title: 'Blessing of Man', value: 'Limit', description: 'Win on the first turn as non-dealer.', type: 'condition-only' },
    ],
  },
  {
    heading: 'Non-traditional hands',
    id: 'non-traditional-hands',
    description: 'Optional/non-traditional hands from the handbook. Clubs may include them by house rule.',
    hands: [
      {
        title: 'Seven Pairs',
        value: '3 fan',
        description: 'Seven pairs.',
        type: 'seven-pairs',
        nonTraditional: true,
        groups: [
          ['c1', 'c1'],
          ['c2', 'c2'],
          ['c3', 'c3'],
          ['b4', 'b4'],
          ['b5', 'b5'],
          ['o6', 'o6'],
          ['south', 'south'],
        ],
      },
      {
        title: 'Three Kongs',
        value: '3 fan',
        description: 'Three of the four sets are kongs; the hand still needs one other set and a pair.',
        type: 'standard',
        nonTraditional: true,
        groups: [
          ['c2', 'c2', 'c2', 'c2'],
          ['b3', 'b3', 'b3', 'b3'],
          ['o4', 'o4', 'o4', 'o4'],
          ['red', 'red', 'red'],
          ['south', 'south'],
        ],
      },
      {
        title: 'Pure Straight',
        value: '3 fan',
        description: 'Sequences 123, 456, 789 in the same suit.',
        type: 'standard',
        nonTraditional: true,
        groups: [
          ['c1', 'c2', 'c3'],
          ['c4', 'c5', 'c6'],
          ['c7', 'c8', 'c9'],
          ['b2', 'b2', 'b2'],
          ['o5', 'o5'],
        ],
      },
      {
        title: 'Mixed Triple Sequence',
        value: '3 fan',
        description: 'Same numbered sequence in all three suits.',
        type: 'standard',
        nonTraditional: true,
        groups: [
          ['c5', 'c6', 'c7'],
          ['b5', 'b6', 'b7'],
          ['o5', 'o6', 'o7'],
          ['red', 'red', 'red'],
          ['north', 'north'],
        ],
      },
      {
        title: 'Two Identical Sequences',
        value: '1 fan',
        description: 'Two copies of the same sequence in the same suit.',
        type: 'standard',
        nonTraditional: true,
        groups: [
          ['b1', 'b2', 'b3'],
          ['b1', 'b2', 'b3'],
          ['c7', 'c8', 'c9'],
          ['east', 'east', 'east'],
          ['south', 'south'],
        ],
      },
      {
        title: 'Three Identical Sequences',
        value: '3 fan',
        description: 'Three copies of the same sequence in the same suit.',
        type: 'standard',
        nonTraditional: true,
        groups: [
          ['o3', 'o4', 'o5'],
          ['o3', 'o4', 'o5'],
          ['o3', 'o4', 'o5'],
          ['b7', 'b7', 'b7'],
          ['red', 'red'],
        ],
      },
      {
        title: 'Four Identical Sequences',
        value: 'Limit',
        description: 'Four copies of the same sequence in the same suit.',
        type: 'standard',
        nonTraditional: true,
        groups: [
          ['c2', 'c3', 'c4'],
          ['c2', 'c3', 'c4'],
          ['c2', 'c3', 'c4'],
          ['c2', 'c3', 'c4'],
          ['b5', 'b5'],
        ],
      },
    ],
  },
]
