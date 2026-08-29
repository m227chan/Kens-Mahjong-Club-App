'use client'

import HandScoringCalculator from '@/components/hand-scoring/HandScoringCalculator'
import type { ScoringRules } from '@/lib/scoring-rules'

type ScoreCalculatorModalProps = {
  clubId: string
  scoringRules: ScoringRules
  onClose: () => void
  onApplyFan?: (fan: number) => void
}

export default function ScoreCalculatorModal({
  clubId,
  scoringRules,
  onClose,
  onApplyFan,
}: ScoreCalculatorModalProps) {
  return (
    <div className="responsive-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <div
        id="score-calculator-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="score-calculator-title"
        data-tour="score-calculator-modal"
        className="responsive-modal-panel hand-scoring-modal flex max-h-[calc(100dvh-3rem)] w-full max-w-6xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="hand-scoring-modal-toolbar">
          <button type="button" className="hand-scoring-close-btn" aria-label="Close score calculator" data-tour="score-calculator-close" onClick={onClose}>×</button>
        </div>
        <div className="hand-scoring-modal-body modal-panel-scroll overflow-y-auto overscroll-contain p-4 sm:p-6">
          <HandScoringCalculator
            clubId={clubId}
            scoringRules={scoringRules}
            onApplyFan={
              onApplyFan
                ? (fan) => {
                    onApplyFan(fan)
                    onClose()
                  }
                : undefined
            }
            embedded
          />
        </div>
      </div>
    </div>
  )
}
