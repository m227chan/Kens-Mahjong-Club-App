'use client'

import { useMemo } from 'react'
import { StaticMahjongTile, type MahjongTileId } from '@/components/MahjongTile'
import {
  meldsFitInTiles,
  subtractMeldsFromTiles,
  suggestSetCandidates,
} from '@/lib/hand-scoring/path-wizard'
import type { Meld } from '@/lib/hand-scoring/types'

type PathsOrganizeStepProps = {
  tiles: MahjongTileId[]
  openMelds: Meld[]
  onOpenMeldsChange: (melds: Meld[]) => void
}

export default function PathsOrganizeStep({ tiles, openMelds, onOpenMeldsChange }: PathsOrganizeStepProps) {
  const looseTiles = useMemo(() => subtractMeldsFromTiles(tiles, openMelds), [tiles, openMelds])
  const candidates = useMemo(() => {
    const suggested = suggestSetCandidates(looseTiles)
    return suggested.filter((candidate) =>
      meldsFitInTiles(looseTiles, [{ tiles: candidate.tiles, concealed: false }]),
    )
  }, [looseTiles])

  const lockCandidate = (candidateTiles: MahjongTileId[]) => {
    if (!meldsFitInTiles(looseTiles, [{ tiles: candidateTiles, concealed: false }])) return
    onOpenMeldsChange([...openMelds, { tiles: [...candidateTiles], concealed: false }])
  }

  const unlockMeld = (index: number) => {
    onOpenMeldsChange(openMelds.filter((_, i) => i !== index))
  }

  return (
    <div className="hand-scoring-field">
      <p className="hand-scoring-hint">
        Lock sets you have already claimed open on the table. Everything else stays loose in hand for analysis.
      </p>

      <div className="hand-scoring-flat-hand">
        <span className="hand-scoring-subheading">Loose in hand</span>
        {looseTiles.length > 0 ? (
          <div className="hand-scoring-flat-hand-tiles">
            {looseTiles.map((id, index) => (
              <span key={`${id}-${index}`} className="hand-scoring-flat-hand-tile-btn" aria-hidden="true">
                <StaticMahjongTile id={id} size={40} />
              </span>
            ))}
          </div>
        ) : (
          <p className="hand-scoring-hint">All tiles are locked open, or the bag is empty.</p>
        )}
      </div>

      {candidates.length > 0 ? (
        <div className="hand-scoring-meld-list">
          <span className="hand-scoring-subheading">Suggested sets to lock open</span>
          {candidates.map((candidate) => (
            <div key={candidate.key} className="hand-scoring-meld-item">
              <div className="hand-scoring-meld-tiles">
                {candidate.tiles.map((id, index) => (
                  <StaticMahjongTile key={`${id}-${index}`} id={id} size={40} />
                ))}
              </div>
              <span className="hand-scoring-meld-meta">{candidate.kind}</span>
              <button type="button" className="hand-scoring-open-btn" onClick={() => lockCandidate(candidate.tiles)}>
                Lock open
              </button>
            </div>
          ))}
        </div>
      ) : (
        <p className="hand-scoring-hint">No obvious pongs, kongs, or chows in the loose tiles yet.</p>
      )}

      {openMelds.length > 0 ? (
        <div className="hand-scoring-meld-list">
          <span className="hand-scoring-subheading">Locked open</span>
          {openMelds.map((meld, index) => (
            <div key={index} className="hand-scoring-meld-item">
              <div className="hand-scoring-meld-tiles">
                {meld.tiles.map((id, tileIndex) => (
                  <StaticMahjongTile key={`${id}-${tileIndex}`} id={id} size={40} />
                ))}
              </div>
              <span className="hand-scoring-meld-visibility-toggle is-open">Open</span>
              <button type="button" className="hand-scoring-remove-btn" aria-label={`Unlock meld ${index + 1}`} onClick={() => unlockMeld(index)}>
                ×
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
