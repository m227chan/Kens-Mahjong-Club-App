'use client'

import { StaticMahjongTile, type MahjongTileId } from '@/components/MahjongTile'
import type { Meld } from '@/lib/hand-scoring/types'

type HandMiniPreviewProps = {
  melds: Meld[]
  pair: MahjongTileId[]
  flatTiles?: MahjongTileId[]
}

export default function HandMiniPreview({ melds, pair, flatTiles }: HandMiniPreviewProps) {
  if (flatTiles?.length) {
    return (
      <div className="hand-scoring-mini-hand">
        <p className="hand-scoring-popover-kicker">Your hand</p>
        <div className="hand-scoring-mini-hand-groups">
          <div className="hand-scoring-mini-hand-group is-flat" title="Special flat hand">
            {flatTiles.map((id, index) => (
              <StaticMahjongTile key={`${id}-${index}`} id={id} size={32} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="hand-scoring-mini-hand">
      <p className="hand-scoring-popover-kicker">Your hand</p>
      <div className="hand-scoring-mini-hand-groups">
        {melds.map((meld, index) => (
          <div
            key={`meld-${index}`}
            className={`hand-scoring-mini-hand-group${meld.concealed ? ' is-concealed' : ' is-open'}`}
            title={meld.concealed ? 'Concealed meld' : 'Open meld'}
          >
            {meld.tiles.map((id, tileIndex) => (
              <StaticMahjongTile key={`${id}-${tileIndex}`} id={id} size={32} />
            ))}
          </div>
        ))}
        {pair.length === 2 ? (
          <div className="hand-scoring-mini-hand-group is-pair" title="Pair">
            {pair.map((id, tileIndex) => (
              <StaticMahjongTile key={`${id}-${tileIndex}`} id={id} size={32} />
            ))}
          </div>
        ) : null}
      </div>
    </div>
  )
}
