'use client'

import type { CSSProperties } from 'react'

export type MahjongTileDefinition =
  | { kind: 'honor'; glyph: string; color: string; name: string }
  | { kind: 'character'; rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; rankGlyph: string; name: string }
  | { kind: 'bamboo'; rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; name: string }
  | { kind: 'circle'; rank: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9; name: string }
  | { kind: 'flower'; glyph: string; label: string; name: string }

export const honorTileIds = ['east', 'south', 'west', 'north', 'red', 'green', 'white'] as const
export const characterTileIds = ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9'] as const
export const bambooTileIds = ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9'] as const
export const circleTileIds = ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9'] as const
export const flowerTileIds = ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'] as const

export const mahjongTiles = {
  c1: { kind: 'character', rank: 1, rankGlyph: '一', name: 'One of characters' },
  c2: { kind: 'character', rank: 2, rankGlyph: '二', name: 'Two of characters' },
  c3: { kind: 'character', rank: 3, rankGlyph: '三', name: 'Three of characters' },
  c4: { kind: 'character', rank: 4, rankGlyph: '四', name: 'Four of characters' },
  c5: { kind: 'character', rank: 5, rankGlyph: '五', name: 'Five of characters' },
  c6: { kind: 'character', rank: 6, rankGlyph: '六', name: 'Six of characters' },
  c7: { kind: 'character', rank: 7, rankGlyph: '七', name: 'Seven of characters' },
  c8: { kind: 'character', rank: 8, rankGlyph: '八', name: 'Eight of characters' },
  c9: { kind: 'character', rank: 9, rankGlyph: '九', name: 'Nine of characters' },
  b1: { kind: 'bamboo', rank: 1, name: 'One of bamboo' },
  b2: { kind: 'bamboo', rank: 2, name: 'Two of bamboo' },
  b3: { kind: 'bamboo', rank: 3, name: 'Three of bamboo' },
  b4: { kind: 'bamboo', rank: 4, name: 'Four of bamboo' },
  b5: { kind: 'bamboo', rank: 5, name: 'Five of bamboo' },
  b6: { kind: 'bamboo', rank: 6, name: 'Six of bamboo' },
  b7: { kind: 'bamboo', rank: 7, name: 'Seven of bamboo' },
  b8: { kind: 'bamboo', rank: 8, name: 'Eight of bamboo' },
  b9: { kind: 'bamboo', rank: 9, name: 'Nine of bamboo' },
  o1: { kind: 'circle', rank: 1, name: 'One of circles' },
  o2: { kind: 'circle', rank: 2, name: 'Two of circles' },
  o3: { kind: 'circle', rank: 3, name: 'Three of circles' },
  o4: { kind: 'circle', rank: 4, name: 'Four of circles' },
  o5: { kind: 'circle', rank: 5, name: 'Five of circles' },
  o6: { kind: 'circle', rank: 6, name: 'Six of circles' },
  o7: { kind: 'circle', rank: 7, name: 'Seven of circles' },
  o8: { kind: 'circle', rank: 8, name: 'Eight of circles' },
  o9: { kind: 'circle', rank: 9, name: 'Nine of circles' },
  east: { kind: 'honor', glyph: '東', color: '#1f568c', name: 'East wind' },
  south: { kind: 'honor', glyph: '南', color: '#1f568c', name: 'South wind' },
  west: { kind: 'honor', glyph: '西', color: '#1f568c', name: 'West wind' },
  north: { kind: 'honor', glyph: '北', color: '#1f568c', name: 'North wind' },
  red: { kind: 'honor', glyph: '中', color: '#c9362b', name: 'Red dragon' },
  green: { kind: 'honor', glyph: '發', color: '#13734f', name: 'Green dragon' },
  white: { kind: 'honor', glyph: '白', color: '#1f568c', name: 'White dragon' },
  flower: { kind: 'flower', glyph: '花', label: 'Flower', name: 'Flower' },
  f1: { kind: 'flower', glyph: '春', label: 'Spring', name: 'Spring flower' },
  f2: { kind: 'flower', glyph: '夏', label: 'Summer', name: 'Summer flower' },
  f3: { kind: 'flower', glyph: '秋', label: 'Autumn', name: 'Autumn flower' },
  f4: { kind: 'flower', glyph: '冬', label: 'Winter', name: 'Winter flower' },
  f5: { kind: 'flower', glyph: '梅', label: 'Plum', name: 'Plum flower' },
  f6: { kind: 'flower', glyph: '蘭', label: 'Orchid', name: 'Orchid flower' },
  f7: { kind: 'flower', glyph: '菊', label: 'Chrysanthemum', name: 'Chrysanthemum flower' },
  f8: { kind: 'flower', glyph: '竹', label: 'Bamboo', name: 'Bamboo flower' },
} as const

export type MahjongTileId = keyof typeof mahjongTiles

const TILE_SPRITE_IMAGE_SIZE = 894
const mahjongTileSprites: Record<
  MahjongTileId,
  { x: number; y: number; width: number; height: number; offsetX?: number }
> = {
  east: { x: 137, y: 203, width: 82, height: 109 },
  south: { x: 219, y: 203, width: 81, height: 109 },
  west: { x: 300, y: 203, width: 82, height: 109 },
  north: { x: 382, y: 203, width: 81, height: 109 },
  red: { x: 463, y: 203, width: 82, height: 109, offsetX: 2 },
  green: { x: 545, y: 203, width: 81, height: 109, offsetX: 2 },
  white: { x: 626, y: 203, width: 82, height: 109 },
  flower: { x: 137, y: 336, width: 81, height: 110 },
  f1: { x: 137, y: 336, width: 81, height: 110 },
  f2: { x: 218, y: 336, width: 81, height: 110 },
  f3: { x: 299, y: 336, width: 81, height: 110 },
  f4: { x: 380, y: 336, width: 81, height: 110 },
  f5: { x: 461, y: 336, width: 81, height: 110 },
  f6: { x: 542, y: 336, width: 81, height: 110 },
  f7: { x: 623, y: 336, width: 81, height: 110 },
  f8: { x: 704, y: 336, width: 81, height: 110 },
  c1: { x: 137, y: 471, width: 81, height: 107 },
  c2: { x: 218, y: 471, width: 81, height: 107 },
  c3: { x: 299, y: 471, width: 81, height: 107 },
  c4: { x: 380, y: 471, width: 81, height: 107 },
  c5: { x: 461, y: 471, width: 81, height: 107 },
  c6: { x: 542, y: 471, width: 81, height: 107 },
  c7: { x: 623, y: 471, width: 81, height: 107 },
  c8: { x: 704, y: 471, width: 81, height: 107 },
  c9: { x: 785, y: 471, width: 81, height: 107 },
  o1: { x: 137, y: 602, width: 81, height: 109 },
  o2: { x: 218, y: 602, width: 81, height: 109 },
  o3: { x: 299, y: 602, width: 81, height: 109 },
  o4: { x: 380, y: 602, width: 81, height: 109, offsetX: 4 },
  o5: { x: 461, y: 602, width: 80, height: 109, offsetX: 4 },
  o6: { x: 541, y: 602, width: 81, height: 109, offsetX: 4 },
  o7: { x: 622, y: 602, width: 81, height: 109, offsetX: 4 },
  o8: { x: 703, y: 602, width: 81, height: 109, offsetX: 4 },
  o9: { x: 784, y: 602, width: 81, height: 109 },
  b1: { x: 137, y: 736, width: 81, height: 107 },
  b2: { x: 218, y: 736, width: 81, height: 107 },
  b3: { x: 299, y: 736, width: 81, height: 107 },
  b4: { x: 380, y: 736, width: 81, height: 107 },
  b5: { x: 461, y: 736, width: 80, height: 107 },
  b6: { x: 541, y: 736, width: 81, height: 107 },
  b7: { x: 622, y: 736, width: 81, height: 107 },
  b8: { x: 703, y: 736, width: 81, height: 107 },
  b9: { x: 784, y: 736, width: 81, height: 107 },
}

const bambooLayouts: Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, readonly [number, number][]> = {
  1: [[32, 38]],
  2: [[28, 24], [36, 50]],
  3: [[32, 18], [32, 36], [32, 54]],
  4: [[22, 24], [22, 50], [42, 24], [42, 50]],
  5: [[22, 20], [42, 20], [32, 36], [22, 52], [42, 52]],
  6: [[22, 18], [22, 36], [22, 54], [42, 18], [42, 36], [42, 54]],
  7: [[32, 14], [22, 30], [42, 30], [22, 46], [42, 46], [22, 62], [42, 62]],
  8: [[22, 18], [42, 18], [22, 34], [42, 34], [22, 50], [42, 50], [22, 66], [42, 66]],
  9: [[22, 16], [42, 16], [22, 32], [42, 32], [22, 48], [42, 48], [22, 64], [42, 64], [32, 36]],
}

const circleLayouts: Record<1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9, readonly [number, number][]> = {
  1: [[32, 36]],
  2: [[26, 30], [38, 46]],
  3: [[26, 24], [32, 36], [38, 48]],
  4: [[22, 22], [42, 22], [22, 50], [42, 50]],
  5: [[18, 18], [46, 18], [32, 36], [18, 54], [46, 54]],
  6: [[18, 18], [46, 18], [18, 36], [46, 36], [18, 54], [46, 54]],
  7: [[32, 14], [18, 30], [46, 30], [18, 46], [46, 46], [18, 62], [46, 62]],
  8: [[18, 18], [46, 18], [18, 34], [46, 34], [18, 50], [46, 50], [18, 66], [46, 66]],
  9: [[18, 18], [46, 18], [18, 34], [46, 34], [18, 50], [46, 50], [18, 66], [46, 66], [32, 36]],
}

const flowerDetails: Record<string, { symbol: string; decoration: string[] }> = {
  Flower: { symbol: '花', decoration: ['M22 44c2-10 10-16 18-16s16 6 18 16c0 0-8-2-18-2s-18 2-18 2Z', 'M32 44V64'] },
  Spring: { symbol: '春', decoration: ['M18 38c10-18 24-18 32 0c0 0-10-2-16 0s-16 0-16 0Z', 'M18 42l28 0'] },
  Summer: { symbol: '夏', decoration: ['M24 22h16M28 22v32M36 22v32M22 42h20'] },
  Autumn: { symbol: '秋', decoration: ['M22 20h20M22 42h20M32 20v28'] },
  Winter: { symbol: '冬', decoration: ['M24 22l16 16M24 38l16-16M32 16v36'] },
  Plum: { symbol: '梅', decoration: ['M24 38c4-18 16-18 20 0c0 0-10-2-12 0s-8 0-8 0Z'] },
  Orchid: { symbol: '蘭', decoration: ['M20 30c12-16 24-10 24 6c0 16-10 16-18 16'] },
  Chrysanthemum: { symbol: '菊', decoration: ['M22 24c0 0 18-8 20 10s-18 16-20 20'] },
  Bamboo: { symbol: '竹', decoration: ['M24 20v28M40 20v28M22 26h20M22 34h20M22 42h20M22 50h20'] },
}

export function MahjongTileSymbol({ tile }: { tile: MahjongTileDefinition }) {
  if (tile.kind === 'honor') {
    if (tile.glyph === '白') {
      return (
        <svg className="mahjong-tile-symbol" viewBox="0 0 64 72" aria-hidden="true">
          <rect x="12" y="12" width="40" height="48" rx="6" fill="none" stroke={tile.color} strokeWidth="6" />
        </svg>
      )
    }

    return (
      <svg className="mahjong-tile-symbol" viewBox="0 0 64 72" aria-hidden="true">
        <text x="32" y="52" textAnchor="middle" fill={tile.color} className="mahjong-honor-glyph">
          {tile.glyph}
        </text>
      </svg>
    )
  }

  if (tile.kind === 'character') {
    return (
      <svg className="mahjong-tile-symbol" viewBox="0 0 64 72" aria-hidden="true">
        <text x="32" y="28" textAnchor="middle" fill="#1f568c" className="mahjong-character-rank">
          {tile.rankGlyph}
        </text>
        <text x="32" y="56" textAnchor="middle" fill="#c9362b" className="mahjong-character-suit">
          萬
        </text>
      </svg>
    )
  }

  if (tile.kind === 'bamboo') {
    return (
      <svg className="mahjong-tile-symbol" viewBox="0 0 64 72" aria-hidden="true">
        {bambooLayouts[tile.rank].map(([x, y], index) => (
          <g key={`${x}-${y}`} transform={`translate(${x} ${y})`}>
            <rect x="-3" y="-12" width="6" height="24" rx="3" fill="#13734f" />
            <path d="M-3 -9l6 0M-3 9l6 0" stroke="#1f568c" strokeWidth="2" />
            {index % 3 === 1 ? <circle cx="0" cy="0" r="3" fill="#c9362b" /> : null}
          </g>
        ))}
      </svg>
    )
  }

  if (tile.kind === 'circle') {
    return (
      <svg className="mahjong-tile-symbol" viewBox="0 0 64 72" aria-hidden="true">
        {circleLayouts[tile.rank].map(([x, y], index) => {
          const colors = ['#1f568c', '#c9362b', '#13734f']
          const color = colors[index % colors.length]
          return (
            <g key={`${x}-${y}`}>
              <circle cx={x} cy={y} r="10" fill="none" stroke={color} strokeWidth="4" />
              <circle cx={x} cy={y} r="4" fill={color} />
            </g>
          )
        })}
      </svg>
    )
  }

  if (tile.kind === 'flower') {
    const detail = flowerDetails[tile.label] || flowerDetails.Flower
    return (
      <svg className="mahjong-tile-symbol" viewBox="0 0 64 72" aria-hidden="true">
        <text x="32" y="32" textAnchor="middle" fill="#c9362b" className="mahjong-character-rank">
          {detail.symbol}
        </text>
        {detail.decoration.map((d, index) => (
          <path key={index} d={d} fill="none" stroke="#13734f" strokeWidth="2" />
        ))}
      </svg>
    )
  }

  return null
}

export function StaticMahjongTile({ id, size = 52, className = '' }: { id: MahjongTileId; size?: number; className?: string }) {
  const tile = mahjongTiles[id]
  const sprite = mahjongTileSprites[id]
  const scale = size / sprite.width
  const style: CSSProperties = {
    width: `${size}px`,
    height: `${Math.round(size * (sprite.height / sprite.width))}px`,
    backgroundImage: 'url(/mahjong-tiles.png)',
    backgroundSize: `${TILE_SPRITE_IMAGE_SIZE * scale}px ${TILE_SPRITE_IMAGE_SIZE * scale}px`,
    backgroundPosition: `-${Math.round((sprite.x + (sprite.offsetX ?? 0)) * scale)}px -${Math.round(sprite.y * scale)}px`,
    backgroundRepeat: 'no-repeat',
    backgroundOrigin: 'content-box',
  }

  return (
    <div className={`static-mahjong-tile ${className}`.trim()} style={style} role="img" aria-label={tile.name} />
  )
}
