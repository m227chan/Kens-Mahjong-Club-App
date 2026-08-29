'use client'

import { useMemo, useState } from 'react'
import {
  StaticMahjongTile,
  characterTileIds,
  bambooTileIds,
  circleTileIds,
  honorTileIds,
  type MahjongTileId,
} from '@/components/MahjongTile'
import type { Meld } from '@/lib/hand-scoring/types'
import FlatHandBuilder from './FlatHandBuilder'

const TILE_GROUPS = [
  { label: 'Characters', ids: characterTileIds },
  { label: 'Bamboo', ids: bambooTileIds },
  { label: 'Circles', ids: circleTileIds },
  { label: 'Honors', ids: honorTileIds },
]

export type HandEntryLayout = 'standard' | 'special-flat'

type MeldBuilderProps = {
  layout: HandEntryLayout
  onLayoutChange: (layout: HandEntryLayout) => void
  melds: Meld[]
  pair: MahjongTileId[]
  flatTiles: MahjongTileId[]
  onMeldsChange: (melds: Meld[]) => void
  onPairChange: (pair: MahjongTileId[]) => void
  onFlatTilesChange: (tiles: MahjongTileId[]) => void
}

type DraftKind = 'empty' | 'pair' | 'meld' | 'invalid'

function draftKindFor(tiles: MahjongTileId[]): DraftKind {
  if (tiles.length === 0) return 'empty'
  if (tiles.length === 2 && tiles[0] === tiles[1]) return 'pair'
  if (tiles.length >= 3 && tiles.length <= 4) return 'meld'
  return 'invalid'
}

export default function MeldBuilder({
  layout,
  onLayoutChange,
  melds,
  pair,
  flatTiles,
  onMeldsChange,
  onPairChange,
  onFlatTilesChange,
}: MeldBuilderProps) {
  const [draftTiles, setDraftTiles] = useState<MahjongTileId[]>([])

  const draftKind = draftKindFor(draftTiles)

  const addMeld = (concealed: boolean) => {
    if (draftKind !== 'meld') return
    onMeldsChange([...melds, { tiles: [...draftTiles], concealed }])
    setDraftTiles([])
  }

  const setPair = () => {
    if (draftKind !== 'pair') return
    onPairChange([...draftTiles])
    setDraftTiles([])
  }

  const removeMeld = (index: number) => {
    onMeldsChange(melds.filter((_, i) => i !== index))
  }

  const toggleMeldConcealed = (index: number) => {
    onMeldsChange(
      melds.map((meld, i) => (i === index ? { ...meld, concealed: !meld.concealed } : meld)),
    )
  }

  const toggleTile = (id: MahjongTileId) => {
    setDraftTiles((prev) => {
      const count = prev.filter((t) => t === id).length
      if (count >= 4) return prev.filter((t) => t !== id)
      return [...prev, id]
    })
  }

  const clearDraft = () => setDraftTiles([])

  const draftLabel = useMemo(() => {
    if (draftKind === 'empty') return 'Select tiles for a meld or pair'
    if (draftKind === 'pair') return 'Pair'
    if (draftKind === 'meld') return `Meld · ${draftTiles.length} tiles`
    if (draftTiles.length === 1) return 'Select 2 matching tiles for a pair, or 3–4 for a meld'
    return 'Two tiles must match for a pair, or add a third for a meld'
  }, [draftKind, draftTiles.length])

  const switchLayout = (nextLayout: HandEntryLayout) => {
    if (nextLayout === layout) return
    onLayoutChange(nextLayout)
  }

  return (
    <div className="hand-scoring-field">
      <div className="hand-scoring-meld-header">
        <span className="hand-scoring-label">Hand tiles</span>
        <div className="hand-scoring-mode-toggle" role="group" aria-label="Entry layout">
          <button
            type="button"
            className={`hand-scoring-chip${layout === 'standard' ? ' is-active' : ''}`}
            aria-pressed={layout === 'standard'}
            onClick={() => switchLayout('standard')}
          >
            Standard
          </button>
          <button
            type="button"
            className={`hand-scoring-chip${layout === 'special-flat' ? ' is-active' : ''}`}
            aria-pressed={layout === 'special-flat'}
            onClick={() => switchLayout('special-flat')}
          >
            Special flat
          </button>
        </div>
      </div>

      {layout === 'special-flat' ? (
        <FlatHandBuilder tiles={flatTiles} onChange={onFlatTilesChange} />
      ) : (
        <>
          <p className="hand-scoring-hint">Select 3–4 tiles for a meld, or 2 matching tiles for the pair.</p>

          <div className="hand-scoring-draft">
            <span className="hand-scoring-draft-label">{draftLabel}</span>
            <div className="hand-scoring-draft-tiles">
              {draftTiles.map((id, index) => (
                <StaticMahjongTile key={`${id}-${index}`} id={id} size={40} />
              ))}
            </div>
            <div className="hand-scoring-draft-actions">
              <button type="button" className="hand-scoring-secondary-btn" onClick={clearDraft} disabled={draftTiles.length === 0}>Clear</button>
              {draftKind === 'pair' ? (
                <button type="button" className="hand-scoring-primary-btn" onClick={setPair}>Set pair</button>
              ) : null}
              {draftKind === 'meld' ? (
                <>
                  <button type="button" className="hand-scoring-primary-btn" onClick={() => addMeld(true)}>Add concealed</button>
                  <button type="button" className="hand-scoring-open-btn" onClick={() => addMeld(false)}>Add open</button>
                </>
              ) : null}
            </div>
          </div>

          {TILE_GROUPS.map((group) => (
            <div key={group.label} className="hand-scoring-tile-group">
              <span className="hand-scoring-tile-group-label">{group.label}</span>
              <div className="hand-scoring-tile-grid">
                {group.ids.map((id) => (
                  <button key={id} type="button" className="hand-scoring-tile-btn" onClick={() => toggleTile(id)}>
                    <StaticMahjongTile id={id} size={36} />
                  </button>
                ))}
              </div>
            </div>
          ))}

          {melds.length > 0 ? (
            <div className="hand-scoring-meld-list">
              <span className="hand-scoring-subheading">Current melds</span>
              {melds.map((meld, index) => (
                <div key={index} className="hand-scoring-meld-item">
                  <div className="hand-scoring-meld-tiles">
                    {meld.tiles.map((id, tileIndex) => (
                      <StaticMahjongTile key={`${id}-${tileIndex}`} id={id} size={40} />
                    ))}
                  </div>
                  <button
                    type="button"
                    className={`hand-scoring-meld-visibility-toggle${meld.concealed ? ' is-concealed' : ' is-open'}`}
                    aria-pressed={meld.concealed}
                    aria-label={`${meld.concealed ? 'Concealed' : 'Open'} meld ${index + 1}. Tap to mark as ${meld.concealed ? 'open' : 'concealed'}.`}
                    onClick={() => toggleMeldConcealed(index)}
                  >
                    {meld.concealed ? 'Concealed' : 'Open'}
                  </button>
                  <button type="button" className="hand-scoring-remove-btn" aria-label={`Remove meld ${index + 1}`} onClick={() => removeMeld(index)}>×</button>
                </div>
              ))}
            </div>
          ) : null}

          {pair.length > 0 ? (
            <div className="hand-scoring-meld-list">
              <span className="hand-scoring-subheading">Pair</span>
              <div className="hand-scoring-meld-item">
                <div className="hand-scoring-meld-tiles">
                  {pair.map((id, index) => (
                    <StaticMahjongTile key={`${id}-${index}`} id={id} size={40} />
                  ))}
                </div>
                <button type="button" className="hand-scoring-remove-btn" aria-label="Remove pair" onClick={() => onPairChange([])}>×</button>
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
