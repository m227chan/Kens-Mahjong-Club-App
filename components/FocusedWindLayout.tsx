'use client'

import { useEffect, useState } from 'react'
import { StaticMahjongTile } from '@/components/MahjongTile'
import type { Wind } from '@/lib/hand-scoring/types'
import type { TablePlayer } from '@/lib/table-checkin-client'
import type { TableWindState } from '@/lib/table-winds'
import {
  COMPASS_POSITIONS,
  WIND_LABELS,
  WIND_PHONETICS,
  seatWindsForOrder,
} from '@/lib/table-winds'

export type WindSeatCard = {
  playerId: string
  player: TablePlayer | undefined
  seatIndex: number
  wind: Wind
  score: number
  isDealer: boolean
}

export function buildWindSeatCards(
  seatOrder: string[],
  windState: TableWindState,
  playersById: Map<string, TablePlayer>,
  scoresByPlayer: Record<string, number>,
): WindSeatCard[] {
  const effectiveDealer = seatOrder.includes(windState.dealerPlayerId)
    ? windState.dealerPlayerId
    : (seatOrder[0] ?? windState.dealerPlayerId)
  const winds = seatWindsForOrder(effectiveDealer, seatOrder)
  return seatOrder.map((playerId, seatIndex) => ({
    playerId,
    player: playersById.get(playerId),
    seatIndex,
    wind: winds[playerId] ?? 'east',
    score: scoresByPlayer[playerId] ?? 0,
    isDealer: playerId === effectiveDealer,
  }))
}

const ROTATION_MS = 800

export default function FocusedWindLayout({
  cards,
  animating,
  onSeatClick,
  onRotationComplete,
}: {
  cards: WindSeatCard[]
  animating: boolean
  onSeatClick: (playerId: string, seatIndex: number) => void
  onRotationComplete?: () => void
}) {
  const [spinning, setSpinning] = useState(false)

  useEffect(() => {
    if (!animating) {
      setSpinning(false)
      return
    }
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduceMotion) {
      onRotationComplete?.()
      return
    }
    // Double-rAF so the browser paints the pre-spin frame before rotating.
    let frame2 = 0
    const frame1 = window.requestAnimationFrame(() => {
      frame2 = window.requestAnimationFrame(() => setSpinning(true))
    })
    const done = window.setTimeout(() => {
      onRotationComplete?.()
    }, ROTATION_MS)
    return () => {
      window.cancelAnimationFrame(frame1)
      window.cancelAnimationFrame(frame2)
      window.clearTimeout(done)
    }
  }, [animating, onRotationComplete])

  const byWind = Object.fromEntries(cards.map((card) => [card.wind, card])) as Partial<
    Record<Wind, WindSeatCard>
  >

  return (
    <div className="focused-wind-compass" aria-label="Table wind seats">
      <div
        className={`focused-wind-stage${spinning ? ' is-rotating' : ''}`}
      >
        {(['west', 'north', 'south', 'east'] as Wind[]).map((wind) => {
          const card = byWind[wind]
          const position = COMPASS_POSITIONS[wind]
          if (!card) {
            return (
              <div
                key={wind}
                className={`focused-wind-seat focused-wind-seat--${position} is-empty`}
              />
            )
          }
          return (
            <button
              key={card.playerId}
              type="button"
              className={`focused-wind-seat focused-wind-seat--${position}${card.isDealer ? ' is-dealer' : ''}`}
              onClick={() => onSeatClick(card.playerId, card.seatIndex)}
              aria-label={`Seat ${card.seatIndex + 1} ${card.player?.displayName ?? 'Empty'}, ${WIND_LABELS[card.wind]}`}
            >
              <span className="focused-wind-seat-inner">
                <span className="focused-wind-tile" aria-hidden="true">
                  <StaticMahjongTile id={card.wind} size={40} />
                </span>
                <span className="focused-wind-meta">
                  <span className="focused-wind-phonetic">
                    ({WIND_PHONETICS[card.wind]}) {WIND_LABELS[card.wind].toLowerCase()}
                  </span>
                  <span className="focused-wind-name">
                    Seat {card.seatIndex + 1}{' '}
                    {(card.player?.displayName ?? 'Empty').toUpperCase()}
                  </span>
                  <span
                    className={`focused-wind-score${card.score < 0 ? ' is-negative' : ''}`}
                  >
                    {card.score > 0 ? `+${card.score}` : card.score}
                  </span>
                </span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export const WIND_ROTATION_MS = ROTATION_MS
