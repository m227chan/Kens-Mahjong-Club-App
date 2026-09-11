'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { MahjongTileId } from '@/components/MahjongTile'
import type { ScoringRules } from '@/lib/scoring-rules'
import type { Meld, Wind } from '@/lib/hand-scoring/types'
import PathsAnalyzeStep from './PathsAnalyzeStep'
import PathsEnterTilesStep from './PathsEnterTilesStep'
import PathsOrganizeStep from './PathsOrganizeStep'

export type PathsWizardStep = 1 | 2 | 3

type PathsWizardProps = {
  tiles: MahjongTileId[]
  openMelds: Meld[]
  flowers: MahjongTileId[]
  seatWind: Wind
  roundWind: Wind
  includeNonTraditional: boolean
  rules: ScoringRules
  onTilesChange: (tiles: MahjongTileId[]) => void
  onOpenMeldsChange: (melds: Meld[]) => void
}

const STEP_LABELS = ['Enter tiles', 'Organize', 'Aim for minimum'] as const

function scrollWizardToTop(node: HTMLElement) {
  const scroller = node.closest('.modal-panel-scroll, .hand-scoring-modal-body')
  if (scroller instanceof HTMLElement) {
    scroller.scrollTo({ top: 0, behavior: 'smooth' })
    return
  }
  node.scrollIntoView({ block: 'start', behavior: 'smooth' })
}

export default function PathsWizard({
  tiles,
  openMelds,
  flowers,
  seatWind,
  roundWind,
  includeNonTraditional,
  rules,
  onTilesChange,
  onOpenMeldsChange,
}: PathsWizardProps) {
  const [step, setStep] = useState<PathsWizardStep>(1)
  const wizardRef = useRef<HTMLDivElement>(null)

  const wizardState = useMemo(
    () => ({
      tiles,
      openMelds,
      flowers,
      seatWind,
      roundWind,
      includeNonTraditional,
    }),
    [tiles, openMelds, flowers, seatWind, roundWind, includeNonTraditional],
  )

  const canGoNext = step === 1 ? tiles.length > 0 : true

  useEffect(() => {
    if (step !== 3) return
    if (typeof window === 'undefined') return
    if (!window.matchMedia('(max-width: 767px)').matches) return

    const node = wizardRef.current
    if (!node) return

    // Wait a frame so step 3 content is mounted before scrolling.
    const frame = window.requestAnimationFrame(() => scrollWizardToTop(node))
    return () => window.cancelAnimationFrame(frame)
  }, [step])

  return (
    <div ref={wizardRef} className="paths-wizard">
      <nav className="paths-wizard-steps" aria-label="Hand helper steps">
        {STEP_LABELS.map((label, index) => {
          const stepNumber = (index + 1) as PathsWizardStep
          const isActive = step === stepNumber
          const isComplete = step > stepNumber
          return (
            <button
              key={label}
              type="button"
              className={`paths-wizard-step${isActive ? ' is-active' : ''}${isComplete ? ' is-complete' : ''}`}
              aria-current={isActive ? 'step' : undefined}
              onClick={() => {
                if (stepNumber === 1 || tiles.length > 0) setStep(stepNumber)
              }}
            >
              <span className="paths-wizard-step-num">{stepNumber}</span>
              <span className="paths-wizard-step-label">{label}</span>
            </button>
          )
        })}
      </nav>

      {step === 1 ? <PathsEnterTilesStep tiles={tiles} onChange={onTilesChange} /> : null}
      {step === 2 ? (
        <PathsOrganizeStep tiles={tiles} openMelds={openMelds} onOpenMeldsChange={onOpenMeldsChange} />
      ) : null}
      {step === 3 ? (
        <PathsAnalyzeStep
          state={wizardState}
          rules={rules}
          onTilesChange={onTilesChange}
          onOpenMeldsChange={onOpenMeldsChange}
        />
      ) : null}

      <div className="paths-wizard-nav">
        <button
          type="button"
          className="hand-scoring-secondary-btn"
          disabled={step === 1}
          onClick={() => setStep((current) => (current > 1 ? ((current - 1) as PathsWizardStep) : current))}
        >
          Back
        </button>
        {step < 3 ? (
          <button
            type="button"
            className="hand-scoring-primary-btn"
            disabled={!canGoNext}
            onClick={() => setStep((current) => (current < 3 ? ((current + 1) as PathsWizardStep) : current))}
          >
            Next
          </button>
        ) : null}
      </div>
    </div>
  )
}
