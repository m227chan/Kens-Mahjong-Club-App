'use client'

import { StaticMahjongTile, type MahjongTileId } from '@/components/MahjongTile'
import type { Meld } from '@/lib/hand-scoring/types'

type HandMiniPreviewProps = {
  melds: Meld[]
  pair: MahjongTileId[]
}

export default function HandMiniPreview({ melds, pair }: HandMiniPreviewProps) {
  return (
    <div className="hand-scoring-mini-hand">
      <p className="hand-scoring-popover-kicker">Your hand</p>
      <div className="hand-scoring-mini-hand-groups">
        {melds.map((meld, index) => (
          <div
            key={`meld-${index}`}
            className={`hand-scoring-mini-hand-group${meld.concealed ? ' is-concealed' : ' is-open'}${meld.tiles.length === 2 ? ' is-pair-group' : ''}`}
            title={meld.tiles.length === 2 ? 'Pair group' : meld.concealed ? 'Concealed meld' : 'Open meld'}
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
