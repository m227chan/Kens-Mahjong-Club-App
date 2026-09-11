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
import {
  FLAT_HAND_MAX_TILE_COUNT,
  FLAT_HAND_TILE_COUNT,
} from '@/lib/hand-scoring/flat-hand-input'
import type { Meld } from '@/lib/hand-scoring/types'

const TILE_GROUPS = [
  { label: 'Characters', ids: characterTileIds },
  { label: 'Bamboo', ids: bambooTileIds },
  { label: 'Circles', ids: circleTileIds },
  { label: 'Honors', ids: honorTileIds },
]

type HandTileBuilderProps = {
  tiles: MahjongTileId[]
  onChange: (tiles: MahjongTileId[]) => void
  melds: Meld[]
  pair?: MahjongTileId[]
  groupingCount: number
  groupingIndex: number
  handIsValid: boolean
  onToggleMeldConcealed: (index: number) => void
  onSwapGrouping: () => void
}

export default function HandTileBuilder({
  tiles,
  onChange,
  melds,
  pair,
  groupingCount,
  groupingIndex,
  handIsValid,
  onToggleMeldConcealed,
  onSwapGrouping,
}: HandTileBuilderProps) {
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
    if (tiles.length >= FLAT_HAND_MAX_TILE_COUNT) return
    onChange([...tiles, id])
  }

  const removeTileAt = (index: number) => {
    onChange(tiles.filter((_, tileIndex) => tileIndex !== index))
  }

  const countLabel =
    tiles.length === 0
      ? 'Select hand tiles'
      : tiles.length < FLAT_HAND_TILE_COUNT
        ? `${tiles.length} / ${FLAT_HAND_TILE_COUNT}+ tiles`
        : `${tiles.length} tiles`

  return (
    <div className="hand-scoring-field">
      <div className="hand-scoring-meld-header">
        <span className="hand-scoring-label">Hand tiles</span>
      </div>

      <p className="hand-scoring-hint">
        Tap every tile in the hand (14 normally, up to 18 with kongs). Melds appear automatically when the hand is valid — then mark concealed/open, or swap grouping if the parse is wrong.
      </p>

      <div className="hand-scoring-flat-hand">
        <div className="hand-scoring-flat-hand-header">
          <span className="hand-scoring-draft-label">{countLabel}</span>
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
              const disabled = tiles.length >= FLAT_HAND_MAX_TILE_COUNT && count === 0
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

      {tiles.length > 0 && !handIsValid ? (
        <p className="hand-scoring-hint">Keep adding tiles until a valid hand is detected.</p>
      ) : null}

      {handIsValid ? (
        <div className="hand-scoring-meld-list">
          <div className="hand-scoring-meld-header">
            <span className="hand-scoring-subheading">Detected melds</span>
            {groupingCount > 1 ? (
              <button
                type="button"
                className="hand-scoring-secondary-btn"
                onClick={onSwapGrouping}
                aria-label={`Swap grouping. Showing ${groupingIndex + 1} of ${groupingCount}.`}
              >
                Swap grouping ({groupingIndex + 1}/{groupingCount})
              </button>
            ) : null}
          </div>

          {melds.map((meld, index) => (
            <div key={index} className="hand-scoring-meld-item">
              <div className="hand-scoring-meld-tiles">
                {meld.tiles.map((id, tileIndex) => (
                  <StaticMahjongTile key={`${id}-${tileIndex}`} id={id} size={40} />
                ))}
              </div>
              {meld.tiles.length >= 3 ? (
                <button
                  type="button"
                  className={`hand-scoring-meld-visibility-toggle${meld.concealed ? ' is-concealed' : ' is-open'}`}
                  aria-pressed={meld.concealed}
                  aria-label={`${meld.concealed ? 'Concealed' : 'Open'} meld ${index + 1}. Tap to mark as ${meld.concealed ? 'open' : 'concealed'}.`}
                  onClick={() => onToggleMeldConcealed(index)}
                >
                  {meld.concealed ? 'Concealed' : 'Open'}
                </button>
              ) : (
                <span className="hand-scoring-meld-meta">Pair group</span>
              )}
            </div>
          ))}

          {pair && pair.length === 2 ? (
            <>
              <span className="hand-scoring-subheading">Pair</span>
              <div className="hand-scoring-meld-item">
                <div className="hand-scoring-meld-tiles">
                  {pair.map((id, index) => (
                    <StaticMahjongTile key={`${id}-${index}`} id={id} size={40} />
                  ))}
                </div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
