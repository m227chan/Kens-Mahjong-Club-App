import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/data', () => ({
  loadAllGames: vi.fn().mockResolvedValue([]),
}))

vi.mock('@/components/network/NetworkGraph', () => ({
  NetworkGraph: () => <div data-testid="network-graph">Network graph</div>,
}))

import NetworkGraphModal from '@/components/NetworkGraphModal'

describe('network graph modal', () => {
  afterEach(() => cleanup())

  it('keeps mobile filters collapsed until requested and collapses them after applying', () => {
    render(
      <NetworkGraphModal
        clubId="CLUB1"
        players={[]}
        seasons={[]}
        currentSeason={2}
        onClose={vi.fn()}
      />,
    )

    const toggle = screen.getByRole('button', { name: /Filters/ })
    const filters = document.getElementById('network-filters')

    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(toggle.textContent).toContain('Season 2 · No date range · All players · 1+ game')
    expect(filters?.className).toContain('hidden')

    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(filters?.className).toContain('block')
    expect(screen.getByLabelText('Season')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Show network' }))
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(filters?.className).toContain('hidden')
  })
})
