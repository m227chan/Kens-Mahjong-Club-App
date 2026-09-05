'use client'

import { useEffect, useState, type ReactNode } from 'react'
import type { ScoringRules } from '@/lib/scoring-rules'
import type { FanCalculationResult, PatternSuggestion } from '@/lib/hand-scoring/types'
import { totalFanDisplay } from '@/lib/hand-scoring/total-fan-display'
import SuggestionListItem from './SuggestionListItem'

type PatternSuggestionsProps = {
  suggestions: PatternSuggestion[]
  rules: ScoringRules
  result: FanCalculationResult
  selectedBonuses: Set<string>
  onToggleBonus: (id: string) => void
}

type SectionId = 'meets-min' | 'compatible' | 'manual'

function SuggestionSection({
  id,
  title,
  count,
  open,
  onToggle,
  children,
}: {
  id: SectionId
  title: string
  count: number
  open: boolean
  onToggle: () => void
  children: ReactNode
}) {
  const panelId = `hand-scoring-suggestions-${id}`

  return (
    <section className="hand-scoring-suggestion-section">
      <button
        type="button"
        className="hand-scoring-suggestion-section-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={onToggle}
      >
        <span className="hand-scoring-suggestion-section-title">{title}</span>
        <span className="hand-scoring-suggestion-section-meta">
          <span className="hand-scoring-suggestion-count">{count}</span>
          <span className="hand-scoring-suggestion-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
        </span>
      </button>
      {open ? (
        <div id={panelId} className="hand-scoring-suggestion-section-panel">
          {children}
        </div>
      ) : null}
    </section>
  )
}

export default function PatternSuggestions({
  suggestions,
  rules,
  result,
  selectedBonuses,
  onToggleBonus,
}: PatternSuggestionsProps) {
  const display = totalFanDisplay(result, rules)
  const [isMobile, setIsMobile] = useState(false)
  const reachable = suggestions.filter((s) => s.compatible && s.fanGap === 0)
  const close = suggestions.filter((s) => s.compatible && s.fanGap !== null && s.fanGap > 0).slice(0, 8)
  const manual = suggestions.filter((s) => s.manualOnly && s.compatible).slice(0, 12)

  const [openSections, setOpenSections] = useState<Record<SectionId, boolean>>({
    'meets-min': true,
    compatible: true,
    manual: true,
  })

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobile(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const toggleSection = (id: SectionId) => {
    setOpenSections((current) => ({ ...current, [id]: !current[id] }))
  }

  return (
    <div className="hand-scoring-suggestions">
      <p className="hand-scoring-kicker">Find winning paths</p>
      <p className="hand-scoring-hint">
        Current locked fan: {display.main}
        {display.limitLabel ? (
          <span className="hand-scoring-limit-label">{display.limitLabel}</span>
        ) : null}
        . Club minimum: {rules.minFan}+.
        {!isMobile ? ' Hover a path to preview the example hand.' : ' Tap Example on a path to preview the hand.'}
      </p>

      <SuggestionSection
        id="meets-min"
        title="Meets minimum now"
        count={reachable.length}
        open={openSections['meets-min']}
        onToggle={() => toggleSection('meets-min')}
      >
        {reachable.length > 0 ? (
          <ul className="hand-scoring-suggestion-list">
            {reachable.map((item) => (
              <SuggestionListItem
                key={item.id}
                item={item}
                isMobile={isMobile}
                fanLabel={item.fan === 'limit' ? 'Limit' : `+${item.fan} fan`}
              />
            ))}
          </ul>
        ) : (
          <p className="hand-scoring-hint">No additional patterns reach the minimum yet.</p>
        )}
      </SuggestionSection>

      <SuggestionSection
        id="compatible"
        title="Still compatible"
        count={close.length}
        open={openSections.compatible}
        onToggle={() => toggleSection('compatible')}
      >
        {close.length > 0 ? (
          <ul className="hand-scoring-suggestion-list">
            {close.map((item) => (
              <SuggestionListItem
                key={item.id}
                item={item}
                isMobile={isMobile}
                fanLabel={item.fanGap === 0 ? 'Ready' : `Need +${item.fanGap} fan`}
              />
            ))}
          </ul>
        ) : (
          <p className="hand-scoring-hint">No other compatible paths to show right now.</p>
        )}
      </SuggestionSection>

      <SuggestionSection
        id="manual"
        title="Manual bonuses"
        count={manual.length}
        open={openSections.manual}
        onToggle={() => toggleSection('manual')}
      >
        {manual.length > 0 ? (
          <ul className="hand-scoring-suggestion-list hand-scoring-suggestion-list-manual">
            {manual.map((item) => (
              <SuggestionListItem
                key={item.id}
                item={item}
                isMobile={isMobile}
                manual
                checked={selectedBonuses.has(item.id)}
                onToggle={() => onToggleBonus(item.id)}
                fanLabel={item.fan === 'limit' ? 'Limit' : `+${item.fan} fan`}
              />
            ))}
          </ul>
        ) : (
          <p className="hand-scoring-hint">No manual bonuses available for this hand state.</p>
        )}
      </SuggestionSection>
    </div>
  )
}
