'use client'

import { StaticMahjongTile, flowerTileIds, mahjongTiles, type MahjongTileId } from '@/components/MahjongTile'
import { seatFlowerTileIds } from '@/lib/hand-scoring/tile-utils'
import type { Wind } from '@/lib/hand-scoring/types'

type FlowerPickerProps = {
  seatWind: Wind
  selected: MahjongTileId[]
  onChange: (flowers: MahjongTileId[]) => void
}

export default function FlowerPicker({ seatWind, selected, onChange }: FlowerPickerProps) {
  const [seatSeason, seatBloom] = seatFlowerTileIds(seatWind)
  const seatFlowerLabels = [seatSeason, seatBloom]
    .map((id) => (mahjongTiles[id].kind === 'flower' ? mahjongTiles[id].label : mahjongTiles[id].name))
    .join(' and ')

  const toggle = (id: MahjongTileId) => {
    if (selected.includes(id)) {
      onChange(selected.filter((f) => f !== id))
    } else {
      onChange([...selected, id])
    }
  }

  return (
    <div className="hand-scoring-field">
      <span className="hand-scoring-label">Flowers</span>
      <p className="hand-scoring-hint">
        Your seat flowers are highlighted. No selection counts as no flowers (1 fan). Both seat flowers score double flower (2 fan).
      </p>
      <p className="hand-scoring-seat-flower-note">
        Seat flowers for you: <strong>{seatFlowerLabels}</strong>
      </p>
      <div className="hand-scoring-tile-grid" role="group" aria-label="Flower tiles">
        {flowerTileIds.map((id) => {
          const isSeatFlower = id === seatSeason || id === seatBloom
          return (
            <button
              key={id}
              type="button"
              aria-pressed={selected.includes(id)}
              aria-label={`${mahjongTiles[id].name}${isSeatFlower ? ' (your seat flower)' : ''}`}
              className={`hand-scoring-tile-btn${selected.includes(id) ? ' is-selected' : ''}${isSeatFlower ? ' is-seat-flower' : ''}`}
              onClick={() => toggle(id)}
            >
              <StaticMahjongTile id={id} size={44} />
              {isSeatFlower ? <span className="hand-scoring-seat-flower-mark">Seat</span> : null}
            </button>
          )
        })}
      </div>
    </div>
  )
}
