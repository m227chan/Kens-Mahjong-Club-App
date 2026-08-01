import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data', () => ({ updateScoringRules: vi.fn() }))

import ScoringRulesSettings from '@/components/ScoringRulesSettings'
import { DEFAULT_SCORING_RULES } from '@/lib/scoring-rules'

describe('ScoringRulesSettings', () => {
  afterEach(cleanup)

  it('starts collapsed and expands only when requested', () => {
    render(<ScoringRulesSettings clubId="TEST" rules={DEFAULT_SCORING_RULES} isManager />)

    expect(screen.queryByLabelText('Minimum fan')).not.toBeInTheDocument()
    expect(screen.getByText('Fan 3–13+ · club-specific point mapping')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit house scoring rules' }))
    expect(screen.getByLabelText('Minimum fan')).toBeInTheDocument()
    expect(screen.getByLabelText('Base points for 13+ fan')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(screen.queryByLabelText('Minimum fan')).not.toBeInTheDocument()
  })
})
