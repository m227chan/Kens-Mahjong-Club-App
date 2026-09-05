import type { MahjongTileId } from '@/components/MahjongTile'
import { mahjongTiles } from '@/components/MahjongTile'
import type { Meld, Wind } from './types'

export type NumberedSuit = 'character' | 'bamboo' | 'circle'

export type ParsedTile =
  | { kind: 'numbered'; suit: NumberedSuit; rank: number; id: MahjongTileId }
  | { kind: 'honor'; honor: MahjongTileId }
  | { kind: 'flower'; id: MahjongTileId }

const WINDS: Wind[] = ['east', 'south', 'west', 'north']
const DRAGONS = ['red', 'green', 'white'] as const

export function parseTile(id: MahjongTileId): ParsedTile {
  const def = mahjongTiles[id]
  if (def.kind === 'character') return { kind: 'numbered', suit: 'character', rank: def.rank, id }
  if (def.kind === 'bamboo') return { kind: 'numbered', suit: 'bamboo', rank: def.rank, id }
  if (def.kind === 'circle') return { kind: 'numbered', suit: 'circle', rank: def.rank, id }
  if (def.kind === 'flower') return { kind: 'flower', id }
  return { kind: 'honor', honor: id }
}

export function isWind(id: MahjongTileId): id is Wind {
  return (WINDS as readonly string[]).includes(id)
}

export function isDragon(id: MahjongTileId): boolean {
  return (DRAGONS as readonly string[]).includes(id)
}

export function isHonor(id: MahjongTileId): boolean {
  return isWind(id) || isDragon(id)
}

export function isTerminal(id: MahjongTileId): boolean {
  const parsed = parseTile(id)
  return parsed.kind === 'numbered' && (parsed.rank === 1 || parsed.rank === 9)
}

export function isPongOrKong(meld: Meld): boolean {
  return meld.tiles.length >= 3 && meld.tiles.every((t) => t === meld.tiles[0])
}

export function isChow(meld: Meld): boolean {
  if (meld.tiles.length !== 3) return false
  const parsed = meld.tiles.map(parseTile)
  if (!parsed.every((p) => p.kind === 'numbered')) return false
  const suit = (parsed[0] as Extract<ParsedTile, { kind: 'numbered' }>).suit
  if (!parsed.every((p) => p.kind === 'numbered' && p.suit === suit)) return false
  const ranks = parsed.map((p) => (p as Extract<ParsedTile, { kind: 'numbered' }>).rank).sort((a, b) => a - b)
  return ranks[1] === ranks[0] + 1 && ranks[2] === ranks[1] + 1
}

export function isKong(meld: Meld): boolean {
  return meld.tiles.length === 4 && meld.tiles.every((t) => t === meld.tiles[0])
}

export function allHandTiles(input: { melds: Meld[]; pair?: MahjongTileId[] }): MahjongTileId[] {
  const tiles = input.melds.flatMap((m) => m.tiles)
  if (input.pair?.length) tiles.push(...input.pair)
  return tiles
}

export function numberedSuitsInHand(tiles: MahjongTileId[]): Set<NumberedSuit> {
  const suits = new Set<NumberedSuit>()
  for (const id of tiles) {
    const p = parseTile(id)
    if (p.kind === 'numbered') suits.add(p.suit)
  }
  return suits
}

export function seatFlowerRank(seatWind: Wind): number {
  return WINDS.indexOf(seatWind) + 1
}

export function seatFlowerTileIds(seatWind: Wind): [MahjongTileId, MahjongTileId] {
  const rank = seatFlowerRank(seatWind)
  return [`f${rank}` as MahjongTileId, `f${rank + 4}` as MahjongTileId]
}

export const SEAT_POSITIONS: { position: 1 | 2 | 3 | 4; wind: Wind; label: string }[] = [
  { position: 1, wind: 'east', label: 'Seat 1 · East' },
  { position: 2, wind: 'south', label: 'Seat 2 · South' },
  { position: 3, wind: 'west', label: 'Seat 3 · West' },
  { position: 4, wind: 'north', label: 'Seat 4 · North' },
]

export function chowKey(meld: Meld): string | null {
  if (!isChow(meld)) return null
  const parsed = meld.tiles.map(parseTile) as Extract<ParsedTile, { kind: 'numbered' }>[]
  return `${parsed[0].suit}:${parsed.map((p) => p.rank).sort((a, b) => a - b).join('-')}`
}

export function countIdenticalChows(melds: Meld[]): number {
  const keys = melds.filter(isChow).map(chowKey).filter(Boolean) as string[]
  const counts = new Map<string, number>()
  for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1)
  return Math.max(0, ...counts.values(), 0)
}
