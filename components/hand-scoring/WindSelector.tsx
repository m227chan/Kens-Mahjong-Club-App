'use client'

import type { Wind } from '@/lib/hand-scoring/types'
import { SEAT_POSITIONS } from '@/lib/hand-scoring/tile-utils'

const ROUND_WINDS: { id: Wind; label: string }[] = [
  { id: 'east', label: 'East' },
  { id: 'south', label: 'South' },
  { id: 'west', label: 'West' },
  { id: 'north', label: 'North' },
]

type WindSelectorProps = {
  seatWind: Wind
  roundWind: Wind
  onSeatWindChange: (wind: Wind) => void
  onRoundWindChange: (wind: Wind) => void
}

export default function WindSelector({
  seatWind,
  roundWind,
  onSeatWindChange,
  onRoundWindChange,
}: WindSelectorProps) {
  return (
    <div className="hand-scoring-winds">
      <div className="hand-scoring-field hand-scoring-roll-field">
        <span className="hand-scoring-label">Your roll position</span>
        <p className="hand-scoring-hint">Sets your seat wind and which flower numbers count for seat flower bonuses.</p>
        <div className="hand-scoring-chip-row" role="group" aria-label="Roll position">
          {SEAT_POSITIONS.map((seat) => (
            <button
              key={`seat-${seat.position}`}
              type="button"
              aria-pressed={seatWind === seat.wind}
              className={`hand-scoring-chip hand-scoring-seat-chip${seatWind === seat.wind ? ' is-active' : ''}`}
              onClick={() => onSeatWindChange(seat.wind)}
            >
              {seat.label}
            </button>
          ))}
        </div>
      </div>
      <div className="hand-scoring-field">
        <span className="hand-scoring-label">Round wind</span>
        <div className="hand-scoring-chip-row" role="group" aria-label="Round wind">
          {ROUND_WINDS.map((wind) => (
            <button
              key={`round-${wind.id}`}
              type="button"
              aria-pressed={roundWind === wind.id}
              className={`hand-scoring-chip${roundWind === wind.id ? ' is-active' : ''}`}
              onClick={() => onRoundWindChange(wind.id)}
            >
              {wind.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
