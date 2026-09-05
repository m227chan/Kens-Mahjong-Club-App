import type { ReactNode } from 'react'
import type { TotalFanExplanation } from '@/lib/hand-scoring/describe-total-fan'

type TotalFanExplanationPanelProps = {
  explanation: TotalFanExplanation
  kicker?: string
  children?: ReactNode
}

export default function TotalFanExplanationPanel({
  explanation,
  kicker = 'How this total was calculated',
  children,
}: TotalFanExplanationPanelProps) {
  return (
    <div className="hand-scoring-total-explanation">
      {children}
      <p className="hand-scoring-popover-kicker">{kicker}</p>
      {explanation.rows.length > 0 ? (
        <dl className="hand-scoring-total-explanation-rows">
          {explanation.rows.map((row, index) => (
            <div
              key={`${row.label}-${index}`}
              className={`hand-scoring-total-explanation-row${row.emphasis ? ' is-emphasis' : ''}`}
            >
              <dt>{row.label}</dt>
              <dd>{row.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      {explanation.notes.map((note) => (
        <p key={note} className="hand-scoring-total-explanation-note">{note}</p>
      ))}
    </div>
  )
}
