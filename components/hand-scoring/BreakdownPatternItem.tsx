'use client'

import { useState } from 'react'
import { getPatternExample } from '@/lib/hand-scoring/pattern-examples'
import type { MatchedPattern } from '@/lib/hand-scoring/types'
import PatternHandExample from './PatternHandExample'

type BreakdownPatternItemProps = {
  pattern: MatchedPattern
  isMobile: boolean
}

export default function BreakdownPatternItem({ pattern, isMobile }: BreakdownPatternItemProps) {
  const [exampleOpen, setExampleOpen] = useState(false)
  const example = getPatternExample(pattern.id)
  const hasExample = Boolean(example)
  const fanLabel = pattern.fan === 'limit' ? 'Limit' : `${pattern.fan} fan`

  return (
    <li
      className={`hand-scoring-breakdown-pattern${hasExample ? ' has-example' : ''}`}
      tabIndex={hasExample && !isMobile ? 0 : undefined}
    >
      <div className="hand-scoring-breakdown-pattern-row">
        <span className="hand-scoring-breakdown-pattern-title">{pattern.title}</span>
        <div className="hand-scoring-breakdown-pattern-actions">
          <strong>{fanLabel}</strong>
          {isMobile && hasExample ? (
            <button
              type="button"
              className="hand-scoring-example-toggle"
              aria-expanded={exampleOpen}
              aria-controls={`hand-scoring-breakdown-example-${pattern.id}`}
              onClick={() => setExampleOpen((current) => !current)}
            >
              {exampleOpen ? 'Hide example' : 'Example'}
            </button>
          ) : null}
        </div>
      </div>

      {isMobile && exampleOpen && example ? (
        <div
          id={`hand-scoring-breakdown-example-${pattern.id}`}
          className="hand-scoring-breakdown-example-panel"
        >
          <PatternHandExample hand={example} compact />
        </div>
      ) : null}

      {!isMobile && example ? (
        <div className="hand-scoring-breakdown-popover" role="tooltip">
          <p className="hand-scoring-popover-kicker">Example hand</p>
          <PatternHandExample hand={example} compact />
        </div>
      ) : null}
    </li>
  )
}
