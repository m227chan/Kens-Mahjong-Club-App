import '@testing-library/jest-dom/vitest'
import { cleanup, render, screen } from '@testing-library/react'
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
})
