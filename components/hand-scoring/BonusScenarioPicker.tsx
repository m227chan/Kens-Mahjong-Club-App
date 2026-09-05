'use client'

import { useEffect, useState } from 'react'
import { MANUAL_BONUS_PATTERNS } from '@/lib/hand-scoring/patterns'

type BonusScenarioPickerProps = {
  selected: Set<string>
  onChange: (bonuses: Set<string>) => void
}

export default function BonusScenarioPicker({ selected, onChange }: BonusScenarioPickerProps) {
  const [isMobile, setIsMobile] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const sync = () => {
      const mobile = media.matches
      setIsMobile(mobile)
      setOpen((current) => (mobile ? current : true))
    }
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const toggle = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    onChange(next)
  }

  const selectedCount = selected.size
  const showPanel = !isMobile || open

  return (
    <div className={`hand-scoring-field hand-scoring-bonus-field${isMobile ? ' is-mobile-collapsible' : ''}`}>
      {isMobile ? (
        <button
          type="button"
          className="hand-scoring-bonus-toggle"
          aria-expanded={open}
          aria-controls="hand-scoring-bonus-panel"
          onClick={() => setOpen((current) => !current)}
        >
          <span className="hand-scoring-bonus-toggle-copy">
            <span className="hand-scoring-label">Bonus scenarios</span>
            <span className="hand-scoring-hint">Winning methods and timing bonuses</span>
          </span>
          <span className="hand-scoring-suggestion-section-meta">
            {selectedCount > 0 ? (
              <span className="hand-scoring-suggestion-count">{selectedCount}</span>
            ) : null}
            <span className="hand-scoring-suggestion-chevron" aria-hidden="true">{open ? '▾' : '▸'}</span>
          </span>
        </button>
      ) : (
        <>
          <span className="hand-scoring-label">Bonus scenarios</span>
          <p className="hand-scoring-hint">Winning methods and timing bonuses that cannot be inferred from tiles alone.</p>
        </>
      )}

      {showPanel ? (
        <div id="hand-scoring-bonus-panel" className="hand-scoring-bonus-list">
          {MANUAL_BONUS_PATTERNS.map((pattern) => (
            <label key={pattern.id} className="hand-scoring-bonus-item">
              <input
                type="checkbox"
                checked={selected.has(pattern.id)}
                onChange={() => toggle(pattern.id)}
              />
              <span className="hand-scoring-bonus-copy">
                <strong>{pattern.title}</strong>
                <small>{pattern.fan === 'limit' ? 'Limit' : `${pattern.fan} fan`} — {pattern.description}</small>
              </span>
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}
