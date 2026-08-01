import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import ScoreCelebration from '@/components/ScoreCelebration'

const players = {
  jane: { displayName: 'Jane', icon: '🐎' },
  bob: { displayName: 'Bob', icon: '🏆' },
}

const player = (playerId: string) => players[playerId as keyof typeof players]

describe('score celebration', () => {
  afterEach(() => cleanup())

  it('shows the shared animated score card for a win', () => {
    render(<ScoreCelebration result={{ winner: 'jane', scores: { jane: 24, bob: -24 } }} player={player} />)

    expect(screen.getByRole('status').parentElement).toBe(document.body)
    expect(screen.getByText('Jane wins!')).toBeTruthy()
    expect(screen.getByText('+24')).toBeTruthy()
    expect(screen.getByText('-24')).toBeTruthy()
  })

  it('shows the same score card for a draw', () => {
    render(<ScoreCelebration result={{ winner: null, scores: { jane: 0, bob: 0 } }} player={player} />)

    expect(screen.getByText('🤝 Draw recorded')).toBeTruthy()
    expect(screen.getAllByText('0')).toHaveLength(2)
  })
})
