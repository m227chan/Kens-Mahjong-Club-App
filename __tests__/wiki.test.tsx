import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WikiPage from '@/app/wiki/page'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { uid: 'wiki-test-user' },
    loading: false,
    signingIn: false,
    authError: null,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    isAdmin: false,
  }),
}))

describe('Mahjong hand wiki', () => {
  afterEach(() => cleanup())

  it('renders the wiki page with hand examples', () => {
    render(<WikiPage />)

    expect(screen.getByRole('heading', { name: 'Hong Kong Mahjong Wiki' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Bonus flowers' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Winning methods' })).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'One of characters' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toBeInTheDocument()
  })

  it('shows Small Three Dragons as a full 14-tile hand with two dragon triplets plus a pair of the last dragon', () => {
    render(<WikiPage />)

    const smallThreeDragonsCard = screen.getByRole('heading', { name: 'Small Three Dragons' }).closest('article')
    expect(smallThreeDragonsCard).not.toBeNull()

    const withinCard = within(smallThreeDragonsCard as HTMLElement)
    const allTileImages = withinCard.getAllByRole('img')
    expect(allTileImages).toHaveLength(14)
    expect(withinCard.getAllByRole('img', { name: 'Red dragon' })).toHaveLength(3)
    expect(withinCard.getAllByRole('img', { name: 'Green dragon' })).toHaveLength(3)
    expect(withinCard.getAllByRole('img', { name: 'White dragon' })).toHaveLength(2)
    expect(withinCard.getAllByRole('img', { name: 'Two of characters' })).toHaveLength(1)
    expect(withinCard.getAllByRole('img', { name: 'Three of characters' })).toHaveLength(1)
    expect(withinCard.getAllByRole('img', { name: 'Four of characters' })).toHaveLength(1)
    expect(withinCard.getAllByRole('img', { name: 'Five of bamboo' })).toHaveLength(1)
    expect(withinCard.getAllByRole('img', { name: 'Six of bamboo' })).toHaveLength(1)
    expect(withinCard.getAllByRole('img', { name: 'Seven of bamboo' })).toHaveLength(1)
  })
})
