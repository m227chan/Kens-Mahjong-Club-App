'use client'

import { useEffect, useMemo, useState } from 'react'
import { describeTotalFan } from '@/lib/hand-scoring/describe-total-fan'
import type { FanCalculationResult } from '@/lib/hand-scoring/types'
import { totalFanDisplay } from '@/lib/hand-scoring/total-fan-display'
import { basePointsForFan, type ScoringRules } from '@/lib/scoring-rules'
import type { MahjongTileId } from '@/components/MahjongTile'
import BreakdownPatternItem from './BreakdownPatternItem'
import HandMiniPreview from './HandMiniPreview'
import TotalFanExplanationPanel from './TotalFanExplanationPanel'
import { isCompleteHand } from '@/lib/hand-scoring/hand-complete'
import type { HandScoringInput } from '@/lib/hand-scoring/types'

type ScoringBreakdownProps = {
  result: FanCalculationResult
  rules: ScoringRules
  melds: HandScoringInput['melds']
  pair: MahjongTileId[]
  flatTiles?: MahjongTileId[]
}

export default function ScoringBreakdown({ result, rules, melds, pair, flatTiles }: ScoringBreakdownProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [patternsOpen, setPatternsOpen] = useState(false)
  const basePoints = basePointsForFan(result.totalFan, rules)
  const explanation = useMemo(() => describeTotalFan(result, rules), [result, rules])
  const display = useMemo(() => totalFanDisplay(result, rules), [result, rules])
  const showPatterns = !isMobile || patternsOpen
  const showHandPreview = useMemo(
    () => isCompleteHand({ melds, pair: pair.length ? pair : undefined }),
    [melds, pair],
  )
  const hasHandTiles = flatTiles?.length ? flatTiles.length > 0 : melds.length > 0 || pair.length > 0
  const handIsValid = showHandPreview

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const update = () => {
      const mobile = media.matches
      setIsMobile(mobile)
      setPatternsOpen((current) => (mobile ? current : true))
    }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [])

  return (
    <div className="hand-scoring-breakdown">
      <div className="hand-scoring-breakdown-header">
        <div className="hand-scoring-total-block">
          <p className="hand-scoring-kicker">Total fan</p>
          <p className="hand-scoring-total">
            {display.main}
            {display.limitLabel ? (
              <span className="hand-scoring-limit-label">{display.limitLabel}</span>
            ) : null}
          </p>
        </div>
        <div className="hand-scoring-breakdown-status">
          <span className={`hand-scoring-badge${result.meetsMinFan ? ' is-pass' : ' is-fail'}`}>
            {result.meetsMinFan ? `Meets ${rules.minFan}+ minimum` : `Below ${rules.minFan} fan minimum`}
          </span>
          {hasHandTiles && !handIsValid ? (
            <p className="hand-scoring-hand-validity">Not valid hand</p>
          ) : null}
        </div>
      </div>

      <TotalFanExplanationPanel explanation={explanation}>
        {showHandPreview ? (
          <HandMiniPreview melds={melds} pair={pair} flatTiles={flatTiles?.length ? flatTiles : undefined} />
        ) : null}
      </TotalFanExplanationPanel>

      {basePoints !== null ? (
        <p className="hand-scoring-base-points">{basePoints} base points</p>
      ) : (
        <p className="hand-scoring-base-points is-muted">No base points at this fan level</p>
      )}

      {result.patterns.length > 0 ? (
        <div className={`hand-scoring-breakdown-patterns${isMobile ? ' is-mobile-collapsible' : ''}`}>
          {isMobile ? (
            <button
              type="button"
              className="hand-scoring-breakdown-patterns-toggle"
              aria-expanded={patternsOpen}
              aria-controls="hand-scoring-breakdown-patterns-panel"
              onClick={() => setPatternsOpen((current) => !current)}
            >
              <span className="hand-scoring-breakdown-patterns-toggle-copy">
                <span className="hand-scoring-label">Pattern examples</span>
                <span className="hand-scoring-hint">Tap Example on a pattern to preview the hand.</span>
              </span>
              <span className="hand-scoring-suggestion-section-meta">
                <span className="hand-scoring-suggestion-count">{result.patterns.length}</span>
                <span className="hand-scoring-suggestion-chevron" aria-hidden="true">{patternsOpen ? '▾' : '▸'}</span>
              </span>
            </button>
          ) : (
            <p className="hand-scoring-hint hand-scoring-breakdown-patterns-hint">
              Hover a pattern to preview the example hand.
            </p>
          )}

          {showPatterns ? (
            <div id="hand-scoring-breakdown-patterns-panel" className="hand-scoring-breakdown-patterns-panel">
              <ul className="hand-scoring-breakdown-pattern-list">
            {result.patterns.map((pattern, index) => (
              <BreakdownPatternItem key={`${pattern.id}-${index}`} pattern={pattern} isMobile={isMobile} />
            ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : (
        <p className="hand-scoring-hint">Add melds, flowers, winds, or bonus scenarios to calculate fan.</p>
      )}
    </div>
  )
}
