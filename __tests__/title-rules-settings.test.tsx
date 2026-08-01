import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data', () => ({ updateTitleRules: vi.fn() }))

import TitleRulesSettings from '@/components/TitleRulesSettings'
import { DEFAULT_TITLE_RULES } from '@/lib/title-rules'

describe('TitleRulesSettings', () => {
  afterEach(cleanup)

  it('starts collapsed and exposes the full manager editor on request', () => {
    render(<TitleRulesSettings clubId="TEST" rules={DEFAULT_TITLE_RULES} isManager />)

    expect(screen.getByText('9 titles · proportional allocation')).toBeInTheDocument()
    expect(screen.queryByDisplayValue('Messiah')).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Edit club titles' }))
    expect(screen.getByDisplayValue('Messiah')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add title' })).toBeInTheDocument()
    expect(screen.getByText('Total: 100% (must equal 100%)')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Collapse' }))
    expect(screen.queryByDisplayValue('Messiah')).not.toBeInTheDocument()
  })

  it('switches to exact counts and offers a middle-rank title', () => {
    render(<TitleRulesSettings clubId="TEST" rules={DEFAULT_TITLE_RULES} isManager />)
    fireEvent.click(screen.getByRole('button', { name: 'Edit club titles' }))
    fireEvent.click(screen.getByLabelText('Top/bottom counts'))

    expect(screen.getAllByText('Use this title for all remaining middle ranks')).toHaveLength(9)
    expect(screen.getByRole('radio', { name: 'Use Monk for remaining middle ranks' })).toBeChecked()
  })
})
