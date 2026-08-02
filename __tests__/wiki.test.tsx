import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'
import WikiPage from '@/app/wiki/page'

describe('Mahjong hand wiki', () => {
  afterEach(() => cleanup())

  it('renders the wiki page with hand examples', () => {
    render(<WikiPage />)

    expect(screen.getByRole('heading', { name: 'Hong Kong Mahjong Wiki' })).toBeInTheDocument()
    expect(screen.getByText('Bonus flowers')).toBeInTheDocument()
    expect(screen.getByText('Winning methods')).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'One of characters' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toBeInTheDocument()
  })
})
