'use client'

import { createPortal } from 'react-dom'

export type ScoreCelebrationResult = {
  scores: Record<string, number>
  winner: string | null
}

type CelebrationPlayer = {
  displayName: string
  icon?: string | null
}

const shortName = (name: string) => name.length > 10 ? `${name.substring(0, 9)}…` : name

export default function ScoreCelebration({
  result,
  player,
}: {
  result: ScoreCelebrationResult | null
  player: (playerId: string) => CelebrationPlayer
}) {
  if (!result || typeof document === 'undefined') return null

  return createPortal(
    <div className="score-flash" role="status" aria-live="polite">
      <div className="celebration-confetti" aria-hidden="true">
        {['🀄', '🎉', '✨', '🎊', '🌸', '⭐', '🧧', '🍀'].map((symbol, index) => (
          <span key={index} style={{ '--burst-index': index } as React.CSSProperties}>{symbol}</span>
        ))}
      </div>
      <div className="score-flash-card">
        {result.winner ? (
          <>
            <p className="celebration-kicker">Game recorded</p>
            <div className="celebration-winner-icon">{player(result.winner).icon || '🏆'}</div>
            <div className="flash-title">{player(result.winner).displayName} wins!</div>
            <p className="celebration-subtitle">A winning hand for the table</p>
          </>
        ) : <div className="flash-title">🤝 Draw recorded</div>}
        <div className="flash-scores">
          {Object.entries(result.scores).map(([playerId, score]) => {
            const info = player(playerId)
            const scoreClass = score > 0 ? 'pos' : score < 0 ? 'neg' : ''
            return (
              <div key={playerId} className={`flash-row ${playerId === result.winner ? 'winner-row' : ''}`}>
                <span>{info.icon || '👤'} {shortName(info.displayName)}</span>
                <span className={`flash-score-val ${scoreClass}`}>{score > 0 ? `+${score}` : score}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}
