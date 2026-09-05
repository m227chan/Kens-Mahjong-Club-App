'use client'

import { StaticMahjongTile } from '@/components/MahjongTile'
import type { WikiHand } from '@/app/wiki/wiki-content'
import { patternHasTileExample } from '@/lib/hand-scoring/pattern-examples'

type PatternHandExampleProps = {
  hand: WikiHand
  compact?: boolean
}

export default function PatternHandExample({ hand, compact = false }: PatternHandExampleProps) {
  const tileSize = compact ? 34 : 44

  return (
    <div className="hand-scoring-pattern-example">
      <p className="hand-scoring-pattern-example-description">{hand.description}</p>

      {hand.type === 'standard' || hand.type === 'seven-pairs' ? (
        <div className="hand-scoring-pattern-example-groups">
          {hand.groups?.map((group, groupIdx) => (
            <div key={groupIdx} className="hand-scoring-pattern-example-group">
              {group.map((tileId, tileIdx) => (
                <StaticMahjongTile key={`${tileId}-${tileIdx}`} id={tileId} size={tileSize} />
              ))}
            </div>
          ))}
        </div>
      ) : hand.type === 'special-flat' || hand.type === 'bonus' ? (
        <div className="hand-scoring-pattern-example-row">
          {hand.tiles && hand.tiles.length > 0 ? (
            hand.tiles.map((tileId, index) => (
              <StaticMahjongTile key={`${tileId}-${index}`} id={tileId} size={tileSize} />
            ))
          ) : (
            <span className="hand-scoring-hint">No example tiles</span>
          )}
        </div>
      ) : null}

      {hand.note ? <p className="hand-scoring-pattern-example-note">{hand.note}</p> : null}
      {!patternHasTileExample(hand) && hand.type === 'condition-only' ? (
        <p className="hand-scoring-hint">Timing or win-method bonus — no fixed tile pattern.</p>
      ) : null}
    </div>
  )
}
