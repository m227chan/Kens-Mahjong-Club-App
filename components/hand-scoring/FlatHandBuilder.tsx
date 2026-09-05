'use client'

import { useMemo } from 'react'
import {
  StaticMahjongTile,
  characterTileIds,
  bambooTileIds,
  circleTileIds,
  honorTileIds,
  type MahjongTileId,
} from '@/components/MahjongTile'
import { FLAT_HAND_TILE_COUNT } from '@/lib/hand-scoring/flat-hand-input'

const TILE_GROUPS = [
  { label: 'Characters', ids: characterTileIds },
  { label: 'Bamboo', ids: bambooTileIds },
  { label: 'Circles', ids: circleTileIds },
  { label: 'Honors', ids: honorTileIds },
]

type FlatHandBuilderProps = {
  tiles: MahjongTileId[]
  onChange: (tiles: MahjongTileId[]) => void
}

export default function FlatHandBuilder({ tiles, onChange }: FlatHandBuilderProps) {
  const counts = useMemo(() => {
    const map = new Map<MahjongTileId, number>()
    for (const tile of tiles) map.set(tile, (map.get(tile) ?? 0) + 1)
    return map
  }, [tiles])

  const toggleTile = (id: MahjongTileId) => {
    const current = counts.get(id) ?? 0
    if (current >= 4) {
      onChange(tiles.filter((tile) => tile !== id))
      return
    }
    if (tiles.length >= FLAT_HAND_TILE_COUNT) return
    onChange([...tiles, id])
  }

  const removeTileAt = (index: number) => {
    onChange(tiles.filter((_, tileIndex) => tileIndex !== index))
  }

  return (
    <>
      <p className="hand-scoring-hint">
        Tap up to {FLAT_HAND_TILE_COUNT} tiles for special hands like Thirteen Orphans or Nine Gates. Meld grouping is handled automatically.
      </p>

      <div className="hand-scoring-flat-hand">
        <div className="hand-scoring-flat-hand-header">
          <span className="hand-scoring-draft-label">
            {tiles.length === 0 ? 'Select hand tiles' : `${tiles.length} / ${FLAT_HAND_TILE_COUNT} tiles`}
          </span>
          <button
            type="button"
            className="hand-scoring-secondary-btn"
            onClick={() => onChange([])}
            disabled={tiles.length === 0}
          >
            Clear all
          </button>
        </div>
        {tiles.length > 0 ? (
          <div className="hand-scoring-flat-hand-tiles">
            {tiles.map((id, index) => (
              <button
                key={`${id}-${index}`}
                type="button"
                className="hand-scoring-flat-hand-tile-btn"
                aria-label={`Remove ${id}`}
                onClick={() => removeTileAt(index)}
              >
                <StaticMahjongTile id={id} size={40} />
              </button>
            ))}
          </div>
        ) : null}
      </div>

      {TILE_GROUPS.map((group) => (
        <div key={group.label} className="hand-scoring-tile-group">
          <span className="hand-scoring-tile-group-label">{group.label}</span>
          <div className="hand-scoring-tile-grid">
            {group.ids.map((id) => {
              const count = counts.get(id) ?? 0
              const disabled = tiles.length >= FLAT_HAND_TILE_COUNT && count === 0
              return (
                <button
                  key={id}
                  type="button"
                  className={`hand-scoring-tile-btn${count > 0 ? ' is-selected' : ''}`}
                  disabled={disabled}
                  aria-pressed={count > 0}
                  onClick={() => toggleTile(id)}
                >
                  <StaticMahjongTile id={id} size={36} />
                  {count > 0 ? <span className="hand-scoring-tile-count">{count}</span> : null}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </>
  )
}
