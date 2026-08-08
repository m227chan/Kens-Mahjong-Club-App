import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import WikiPage from '@/app/wiki/page'

const dataMocks = vi.hoisted(() => ({
  subscribeScoringRules: vi.fn(),
  subscribeUserClubs: vi.fn(),
}))
const authMocks = vi.hoisted(() => ({
  user: { uid: 'wiki-test-user' },
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn() }),
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: authMocks.user,
    loading: false,
    signingIn: false,
    authError: null,
    signInWithGoogle: vi.fn(),
    signOut: vi.fn(),
    isAdmin: false,
  }),
}))

vi.mock('@/lib/data', () => ({
  subscribeScoringRules: dataMocks.subscribeScoringRules,
  subscribeUserClubs: dataMocks.subscribeUserClubs,
}))

describe('Mahjong hand wiki', () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    dataMocks.subscribeScoringRules.mockReset()
    dataMocks.subscribeUserClubs.mockReset()
  })

  it('renders the wiki page with hand examples', () => {
    render(<WikiPage />)

    expect(screen.getByRole('heading', { name: 'Hong Kong Mahjong Wiki' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Mahjong basics', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Flowers', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Winning methods', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'How scoring works', level: 2 })).toBeInTheDocument()
    expect(screen.getByRole('table', { name: 'Hong Kong Mahjong fan to base points reference' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '384' })).toBeInTheDocument()
    expect(screen.getByText('Everyone pays the base value')).toBeInTheDocument()
    expect(screen.getAllByRole('img', { name: 'One of characters' }).length).toBeGreaterThan(0)
    expect(screen.getByRole('link', { name: 'Back to dashboard' })).toBeInTheDocument()
  })

  it('keeps the contents drawer keyboard and touch friendly', () => {
    render(<WikiPage />)

    const toggle = screen.getByRole('button', { name: 'Tuck away contents' })
    expect(toggle).toHaveAttribute('aria-controls', 'wiki-contents')
    expect(toggle).toHaveAttribute('aria-expanded', 'true')

    fireEvent.click(toggle)

    expect(screen.getByRole('button', { name: 'Open table of contents' })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByRole('button', { name: 'Open table of contents' })).toBeInTheDocument()
  })

  it('highlights the section that has crossed the reading line while scrolling', () => {
    const topBySection: Record<string, number> = {
      'mahjong-basics': 0,
      'complete-tile-reference': 420,
      'scoring-guide': 780,
      'bonus-flowers': 1120,
      'winning-methods': 1460,
    }
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
      const top = topBySection[this.id] ?? 2_000
      return {
        top,
        bottom: top + 320,
        left: 0,
        right: 320,
        width: 320,
        height: 320,
        x: 0,
        y: top,
        toJSON: () => ({}),
      } as DOMRect
    })
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0)
      return 1
    })

    render(<WikiPage />)
    expect(screen.getByRole('link', { name: /Mahjong basics/ })).toHaveAttribute('aria-current', 'location')

    topBySection['mahjong-basics'] = -800
    topBySection['complete-tile-reference'] = -440
    topBySection['scoring-guide'] = -120
    topBySection['bonus-flowers'] = 110

    fireEvent.scroll(window)

    expect(screen.getByRole('link', { name: /Flowers/ })).toHaveAttribute('aria-current', 'location')
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

  it('updates payment examples to match the selected club fan-to-point mapping', async () => {
    dataMocks.subscribeUserClubs.mockImplementation((_uid, callback) => {
      callback([{ clubId: 'HOUSE01', clubName: 'House Rules', role: 'member' }])
      return () => undefined
    })
    dataMocks.subscribeScoringRules.mockImplementation((_clubId, callback) => {
      callback({
        minFan: 3,
        maxFan: 13,
        fanPoints: { 3: 100, 4: 200, 5: 24, 6: 32, 7: 60, 8: 64, 9: 96, 10: 128, 11: 192, 12: 256, 13: 384 },
      })
      return () => undefined
    })

    render(<WikiPage />)

    expect(await screen.findByText('4 fan = 200 base points. Each of the other 3 players pays 200.')).toBeInTheDocument()
    expect(screen.getByText('7 fan = 60 base points. The discarder pays 120.')).toBeInTheDocument()
  })
})
