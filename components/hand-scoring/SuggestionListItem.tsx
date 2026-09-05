'use client'

import { useState } from 'react'
import { getPatternExample } from '@/lib/hand-scoring/pattern-examples'
import type { PatternSuggestion } from '@/lib/hand-scoring/types'
import PatternHandExample from './PatternHandExample'

type SuggestionListItemProps = {
  item: PatternSuggestion
  fanLabel: string
  isMobile: boolean
  manual?: boolean
  checked?: boolean
  onToggle?: () => void
}

export default function SuggestionListItem({
  item,
  fanLabel,
  isMobile,
  manual = false,
  checked = false,
  onToggle,
}: SuggestionListItemProps) {
  const [exampleOpen, setExampleOpen] = useState(false)
  const example = getPatternExample(item.id)
  const hasExample = Boolean(example)

  return (
    <li
      className={`hand-scoring-suggestion-item${hasExample ? ' has-example' : ''}`}
      tabIndex={hasExample && !isMobile ? 0 : undefined}
    >
      <div className="hand-scoring-suggestion-row">
        {manual ? (
          <label className="hand-scoring-suggestion-toggle">
            <input type="checkbox" checked={checked} onChange={onToggle} />
            <span>{item.title}</span>
          </label>
        ) : (
          <span className="hand-scoring-suggestion-title">{item.title}</span>
        )}
        <div className="hand-scoring-suggestion-actions">
          <strong>{fanLabel}</strong>
          {isMobile && hasExample ? (
            <button
              type="button"
              className="hand-scoring-example-toggle"
              aria-expanded={exampleOpen}
              aria-controls={`hand-scoring-example-${item.id}`}
              onClick={() => setExampleOpen((current) => !current)}
            >
              {exampleOpen ? 'Hide example' : 'Example'}
            </button>
          ) : null}
        </div>
      </div>

      {isMobile && exampleOpen && example ? (
        <div id={`hand-scoring-example-${item.id}`} className="hand-scoring-suggestion-example-panel">
          <PatternHandExample hand={example} compact />
        </div>
      ) : null}

      {!isMobile && example ? (
        <div className="hand-scoring-suggestion-popover" role="tooltip">
          <p className="hand-scoring-popover-kicker">Example hand</p>
          <PatternHandExample hand={example} compact />
        </div>
      ) : null}
    </li>
  )
}
