'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useRef, useState, type MouseEvent } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import {
  StaticMahjongTile,
  mahjongTiles,
  type MahjongTileId,
  honorTileIds,
  flowerTileIds,
  characterTileIds,
  circleTileIds,
  bambooTileIds,
} from '@/components/MahjongTile'
import { subscribeScoringRules, subscribeUserClubs } from '@/lib/data'
import { DEFAULT_SCORING_RULES, fanLabel, fanValues, type ScoringRules } from '@/lib/scoring-rules'
import type { ClubMembershipDoc } from '@/lib/types'

const TILE_CATEGORIES = [
  {
    heading: 'Honor tiles',
    description: 'Wind and dragon tiles are used for honor sets and value hands.',
    ids: honorTileIds,
  },
  {
    heading: 'Flower tiles',
    description: 'Bonus flowers are separate from the main suits and appear in special hands.',
    ids: flowerTileIds,
  },
  {
    heading: 'Character suit',
    description: 'The character suit (萬) runs from 1 through 9.',
    ids: characterTileIds,
  },
  {
    heading: 'Circle suit',
    description: 'The circle suit runs from 1 through 9.',
    ids: circleTileIds,
  },
  {
    heading: 'Bamboo suit',
    description: 'The bamboo suit runs from 1 through 9.',
    ids: bambooTileIds,
  },
]

const FAN_POINTS = [
  [0, 1],
  [1, 2],
  [2, 4],
  [3, 8],
  [4, 16],
  [5, 24],
  [6, 32],
  [7, 48],
  [8, 64],
  [9, 96],
  [10, 128],
  [11, 192],
  [12, 256],
  [13, 384],
] as const

const HAND_SECTIONS = [
  {
    heading: 'Bonus flowers',
    description: 'Flower bonuses have different values, shown on each card below. Clubs may include them as house rules.',
    id: 'bonus-flowers',
    hands: [
      { title: 'No Flowers', value: '1 fan', description: 'Have no flowers.', tiles: [] },
      { title: 'Seat Flower', value: '1 fan', description: 'Have a flower matching your seat.', tiles: ['f1'] as MahjongTileId[] },
      { title: 'Set of Flowers', value: '2 fan', description: 'Have 4 flowers of the same series.', tiles: ['f1', 'f2', 'f3', 'f4'] as MahjongTileId[] },
      { title: '7 Flowers', value: '3 fan', description: 'Draw 7 flowers and optionally win immediately.', tiles: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7'] as MahjongTileId[] },
      { title: '8 Flowers', value: '8 fan', description: 'Draw 8 flowers and optionally win immediately.', tiles: ['f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7', 'f8'] as MahjongTileId[] },
    ],
  },
  {
    heading: 'Winning methods',
    id: 'winning-methods',
    description: 'These methods are worth one fan each unless otherwise noted.',
    hands: [
      { title: 'Self Draw', value: '1 fan', description: 'Draw the winning tile yourself.' },
      { title: 'Concealed Hand', value: '1 fan', description: 'Win without calling chow, pong, or kong.' },
      { title: 'Win on Final Tile', value: '1 fan', description: 'Win by drawing the final tile in the wall, or when another player discards the final tile.' },
      { title: 'After a Kong', value: '1 fan', description: 'Win with the replacement tile after calling kong.' },
      { title: 'After Multiple Kongs', value: '8 fan', description: 'Call kong multiple times in a row and win with the replacement tile.' },
      { title: 'Robbing a Kong', value: '1 fan', description: 'When a player calls kong to add a tile to an open triplet, win by taking that tile.' },
    ],
  },
  {
    heading: 'Suit-based hands',
    id: 'suit-based-hands',
    description: 'Suit-based hands are scored by the tiles they contain.',
    hands: [
      { title: 'Mixed Flush', value: '3 fan', description: 'Only tiles from a single suit plus honor tiles.', tiles: ['c2', 'c3', 'c4', 'c6', 'c7', 'c8', 'red', 'red', 'green', 'green', 'east', 'east', 'east', 'east'] as MahjongTileId[] },
      { title: 'Pure Flush', value: '7 fan', description: 'Only tiles from a single suit.', tiles: ['b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'b1', 'b1', 'b1', 'b9', 'b9', 'b9'] as MahjongTileId[] },
    ],
  },
  {
    heading: 'Honor hands',
    id: 'honor-hands',
    description: 'Honor hands rely on wind and dragon triplets or all honors.',
    hands: [
      { title: 'Dragon Triplet', value: '1 fan', description: 'Have a triplet of dragon tiles, like red dragon.', tiles: ['red', 'red', 'red', 'c2', 'c3', 'c4', 'b5', 'b6', 'b7', 'o1', 'o2', 'o3', 'c1', 'c1'] as MahjongTileId[] },
      { title: 'Round Wind', value: '1 fan', description: 'Have a triplet of the wind matching the round.', tiles: ['east', 'east', 'east', 'c4', 'c5', 'c6', 'b3', 'b4', 'b5', 'o2', 'o3', 'o4', 'c1', 'c1'] as MahjongTileId[] },
      { title: 'Seat Wind', value: '1 fan', description: 'Have a triplet of the wind matching your seat.', tiles: ['south', 'south', 'south', 'c4', 'c5', 'c6', 'b3', 'b4', 'b5', 'o2', 'o3', 'o4', 'c1', 'c1'] as MahjongTileId[] },
      { title: 'Small Three Dragons', value: '5 fan', description: 'Have 2 dragon triplets and a pair of the third. Do not add separate dragon-triplet points.', tiles: ['red', 'red', 'red', 'green', 'green', 'green', 'white', 'white', 'c2', 'c3', 'c4', 'b5', 'b6', 'b7'] as MahjongTileId[] },
      { title: 'Big Three Dragons', value: '8 fan', description: 'Have triplets of all 3 dragons. Do not add separate dragon-triplet points.', tiles: ['red', 'red', 'red', 'green', 'green', 'green', 'white', 'white', 'white', 'c2', 'c2'] as MahjongTileId[] },
      { title: 'Small Four Winds', value: '6 fan', description: 'Have triplets of 3 winds and a pair of the 4th. Do not add separate wind-triplet points or combine with half flush.', tiles: ['east', 'east', 'east', 'south', 'south', 'south', 'west', 'west', 'west', 'north', 'north'] as MahjongTileId[] },
      { title: 'Big Four Winds', value: 'Limit', description: 'Have triplets of all 4 winds.', tiles: ['east', 'east', 'east', 'south', 'south', 'south', 'west', 'west', 'west', 'north', 'north', 'north', 'c1', 'c1'] as MahjongTileId[] },
      { title: 'All Honors', value: '10 fan', description: 'Only honor tiles in the hand.', tiles: ['east', 'east', 'east', 'south', 'south', 'south', 'red', 'red', 'red', 'white', 'white', 'white', 'green', 'green'] as MahjongTileId[] },
    ],
  },
  {
    heading: 'Triplet hands',
    id: 'triplet-hands',
    description: 'Triplet-based hands score strongly when the whole hand contains sets of triplets.',
    hands: [
      { title: 'All Triplets', value: '3 fan', description: 'Hand only contains triplets.', tiles: ['c1', 'c1', 'c1', 'c2', 'c2', 'c2', 'c3', 'c3', 'c3', 'red', 'red', 'red', 'b5', 'b5'] as MahjongTileId[] },
      { title: 'Four Concealed Triplets', value: '8 fan', description: 'Hand only contains triplets, all self-drawn.', tiles: ['b2', 'b2', 'b2', 'b3', 'b3', 'b3', 'b4', 'b4', 'b4', 'o5', 'o5', 'o5', 'c7', 'c7'] as MahjongTileId[] },
      { title: 'Mixed Terminals', value: '4 fan', description: 'Hand only contains terminals and honors.', tiles: ['c1', 'c1', 'c1', 'c9', 'c9', 'c9', 'red', 'red', 'red', 'east', 'east', 'east', 'b1', 'b1'] as MahjongTileId[] },
      { title: 'All Terminals', value: 'Limit', description: 'Hand contains only terminal tiles: 1s and 9s.', tiles: ['c1', 'c1', 'c1', 'c9', 'c9', 'c9', 'b1', 'b1', 'b1', 'b9', 'b9', 'b9', 'o1', 'o1'] as MahjongTileId[] },
      { title: 'Four Kongs', value: 'Limit', description: 'Hand contains 4 kongs.', tiles: ['red', 'red', 'red', 'red', 'green', 'green', 'green', 'green', 'east', 'east', 'east', 'east', 'c2', 'c2'] as MahjongTileId[] },
    ],
  },
  {
    heading: 'Sequence and special hands',
    id: 'sequence-special-hands',
    description: 'Common sequence-based hands and special patterns from the manual.',
    hands: [
      { title: 'All Sequences', value: '1 fan', description: 'Only sequences and a pair.', tiles: ['c2', 'c3', 'c4', 'b2', 'b3', 'b4', 'o2', 'o3', 'o4', 'c7', 'c8', 'c9', 'south', 'south'] as MahjongTileId[] },
      { title: 'Thirteen Orphans', value: 'Limit', description: 'Have one of each terminal and honor, plus a pair of any one of those tiles.', tiles: ['c1', 'c9', 'b1', 'b9', 'o1', 'o9', 'east', 'south', 'west', 'north', 'red', 'green', 'white', 'c1'] as MahjongTileId[] },
      { title: 'Nine Gates', value: 'Limit', description: 'Have the concealed pattern 1112345678999 and win on any tile 1–9.', tiles: ['c1', 'c1', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'c9', 'c9', 'c1'] as MahjongTileId[] },
      { title: 'Blessing of Heaven', value: 'Limit', description: 'Win on the first turn as the dealer.', tiles: ['b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'b8', 'b9', 'east', 'east', 'east', 'red', 'red'] as MahjongTileId[] },
      { title: 'Blessing of Earth', value: 'Limit', description: "Win on the first dealer's first discard.", tiles: ['o1', 'o2', 'o3', 'o4', 'o5', 'o6', 'o7', 'o8', 'o9', 'south', 'south', 'south', 'green', 'green'] as MahjongTileId[] },
      { title: 'Blessing of Man', value: 'Limit', description: 'Win on the first turn as non-dealer.', tiles: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'west', 'west', 'west', 'white', 'white'] as MahjongTileId[] },
    ],
  },
  {
    heading: 'Non-traditional hands',
    id: 'non-traditional-hands',
    description: 'Optional hands that are not part of traditional Hong Kong Mahjong. Clubs may include them by house rule; many other optional hands are possible.',
    hands: [
      { title: 'Seven Pairs', value: '3 fan', description: 'Hand contains 7 pairs.', tiles: ['c1', 'c1', 'c2', 'c2', 'c3', 'c3', 'b4', 'b4', 'b5', 'b5', 'o6', 'o6', 'south', 'south'] as MahjongTileId[] },
      { title: 'Three Kongs', value: '3 fan', description: 'Hand contains 3 kongs.', tiles: ['c2', 'c2', 'c2', 'c2', 'b3', 'b3', 'b3', 'b3', 'o4', 'o4', 'o4', 'o4', 'red', 'red'] as MahjongTileId[] },
      { title: 'Pure Straight', value: '3 fan', description: 'Have the sequences 123, 456, 789 in the same suit.', tiles: ['c1', 'c2', 'c3', 'c4', 'c5', 'c6', 'c7', 'c8', 'c9', 'red', 'red', 'red', 'south', 'south'] as MahjongTileId[] },
      { title: 'Mixed Triple Sequence', value: '3 fan', description: 'Have the same numbered sequence in each suit.', tiles: ['c5', 'c6', 'c7', 'b5', 'b6', 'b7', 'o5', 'o6', 'o7', 'red', 'red', 'red', 'north', 'north'] as MahjongTileId[] },
      { title: 'Two Identical Sequences', value: '1 fan', description: 'Have 2 of the same sequence in the same suit.', tiles: ['b1', 'b2', 'b3', 'b1', 'b2', 'b3', 'c7', 'c8', 'c9', 'east', 'east', 'east', 'south', 'south'] as MahjongTileId[] },
      { title: 'Three Identical Sequences', value: '3 fan', description: 'Have 3 of the same sequence in the same suit.', tiles: ['o3', 'o4', 'o5', 'o3', 'o4', 'o5', 'o3', 'o4', 'o5', 'east', 'east', 'east', 'red', 'red'] as MahjongTileId[] },
      { title: 'Four Identical Sequences', value: 'Limit', description: 'Have 4 of the same sequence in the same suit.', tiles: ['c2', 'c3', 'c4', 'c2', 'c3', 'c4', 'c2', 'c3', 'c4', 'c2', 'c3', 'c4', 'north', 'north'] as MahjongTileId[] },
    ],
  },
]

function HandExample({ title, value, description, tiles }: { title: string; value: string; description: string; tiles?: MahjongTileId[] }) {
  return (
    <article className="wiki-hand-card">
      <div className="wiki-hand-card-header">
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
        <span className="wiki-hand-value">{value}</span>
      </div>
      {tiles ? (
        <div className="wiki-hand-tile-row">
          {tiles.length ? (
            tiles.map((tile, index) => <StaticMahjongTile key={`${tile}-${index}`} id={tile} />)
          ) : (
            <span className="wiki-hand-empty">No tiles required</span>
          )}
        </div>
      ) : null}
    </article>
  )
}

const sections = [
  { id: 'scoring-guide', label: 'Scoring guide' },
  { id: 'complete-tile-reference', label: 'Tile reference' },
  ...HAND_SECTIONS.map((section) => ({ id: section.id, label: section.heading })),
]

export default function WikiPage() {
  const [activeSection, setActiveSection] = useState('scoring-guide')
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [clubOptions, setClubOptions] = useState<ClubMembershipDoc[]>([])
  const [selectedClubId, setSelectedClubId] = useState<string | null>(null)
  const [requestedClubId, setRequestedClubId] = useState<string | null>(null)
  const [scoringRules, setScoringRules] = useState<ScoringRules>(DEFAULT_SCORING_RULES)
  const touchStartX = useRef<number | null>(null)
  const touchStartY = useRef<number | null>(null)
  const touchActive = useRef(false)
  const touchStartedInSidebar = useRef(false)
  const { user, loading } = useAuth()
  const router = useRouter()
  const selectedClub = clubOptions.find((club) => club.clubId === selectedClubId) ?? null
  const displayedFanValues = selectedClubId ? fanValues(scoringRules) : FAN_POINTS.map(([fan]) => fan)
  const exampleFan = (preferredFan: number) =>
    displayedFanValues.reduce(
      (closestFan, fan) =>
        Math.abs(fan - preferredFan) < Math.abs(closestFan - preferredFan)
          ? fan
          : closestFan,
      displayedFanValues[0] ?? preferredFan,
    )
  const pointValueForFan = (fan: number) =>
    selectedClub
      ? scoringRules.fanPoints[fan]
      : FAN_POINTS.find(([referenceFan]) => referenceFan === fan)?.[1]
  const exampleFanLabel = (fan: number) =>
    selectedClub ? fanLabel(fan, scoringRules) : String(fan)
  const selfDrawExampleFan = exampleFan(4)
  const selfDrawExamplePoints = pointValueForFan(selfDrawExampleFan) ?? 0
  const discardExampleFan = exampleFan(7)
  const discardExamplePoints = pointValueForFan(discardExampleFan) ?? 0

  const sectionIds = useMemo(() => sections.map((section) => section.id), [])

  const handleTocClick = (id: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault()
    setActiveSection(id)
    const target = document.getElementById(id)
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      window.history.replaceState(null, '', `#${id}`)
      window.setTimeout(() => setActiveSection(id), 250)
    }

    if (window.matchMedia('(max-width: 1024px)').matches) {
      setSidebarOpen(false)
    }
  }

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [loading, router, user])

  useEffect(() => {
    if (typeof window.matchMedia === 'function' && window.matchMedia('(max-width: 1024px)').matches) {
      setSidebarOpen(false)
    }
  }, [])

  useEffect(() => {
    const clubId = new URLSearchParams(window.location.search).get('club')?.trim().toUpperCase()
    setRequestedClubId(clubId || null)
  }, [])

  useEffect(() => {
    if (!user) {
      setClubOptions([])
      setSelectedClubId(null)
      return
    }
    return subscribeUserClubs(user.uid, setClubOptions)
  }, [user])

  useEffect(() => {
    setSelectedClubId((current) => {
      if (requestedClubId && clubOptions.some((club) => club.clubId === requestedClubId)) return requestedClubId
      if (current && clubOptions.some((club) => club.clubId === current)) return current
      return clubOptions[0]?.clubId ?? null
    })
  }, [clubOptions, requestedClubId])

  useEffect(() => {
    if (!selectedClubId) {
      setScoringRules(DEFAULT_SCORING_RULES)
      return
    }
    return subscribeScoringRules(selectedClubId, setScoringRules)
  }, [selectedClubId])

  const handleClubChange = (clubId: string) => {
    const nextClubId = clubId || null
    setSelectedClubId(nextClubId)
    const nextUrl = nextClubId ? `/wiki?club=${encodeURIComponent(nextClubId)}` : '/wiki'
    window.history.replaceState(null, '', nextUrl)
  }

  useEffect(() => {
    let animationFrame: number | null = null

    const updateActiveSection = () => {
      animationFrame = null
      // A fixed reading line makes the highlight stable for sections of very
      // different heights. Intersection ratios made the tallest section win
      // long after the reader had entered the next one.
      const readingLine = Math.min(220, Math.max(96, window.innerHeight * 0.28))
      const nextActiveSection =
        [...sectionIds]
          .reverse()
          .find((id) => {
            const section = document.getElementById(id)
            return section !== null && section.getBoundingClientRect().top <= readingLine
          }) ??
        sectionIds[0]

      setActiveSection((current) =>
        current === nextActiveSection ? current : nextActiveSection,
      )
    }

    const queueActiveSectionUpdate = () => {
      if (animationFrame !== null) return
      animationFrame = window.requestAnimationFrame(updateActiveSection)
    }

    updateActiveSection()
    window.addEventListener('scroll', queueActiveSectionUpdate, { passive: true })
    window.addEventListener('resize', queueActiveSectionUpdate)

    return () => {
      window.removeEventListener('scroll', queueActiveSectionUpdate)
      window.removeEventListener('resize', queueActiveSectionUpdate)
      if (animationFrame !== null) window.cancelAnimationFrame(animationFrame)
    }
  }, [sectionIds])

  useEffect(() => {
    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length !== 1) return
      if (window.innerWidth > 1024) return
      const touch = event.touches[0]
      if (touch.clientY < 100) return

      touchStartX.current = touch.clientX
      touchStartY.current = touch.clientY
      touchActive.current = true

      const sidebarWidth = Math.min(window.innerWidth * 0.84, 320)
      const edgeStart = !sidebarOpen && touch.clientX < 24
      const sidebarStart = sidebarOpen && touch.clientX < sidebarWidth
      touchStartedInSidebar.current = edgeStart || sidebarStart
    }

    const handleTouchMove = (event: TouchEvent) => {
      if (!touchActive.current || touchStartX.current === null || touchStartY.current === null) return
      const touch = event.touches[0]
      const deltaX = touch.clientX - touchStartX.current
      const deltaY = touch.clientY - touchStartY.current

      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        touchActive.current = false
        return
      }

      if (Math.abs(deltaX) > 40) {
        if (deltaX > 0 && !sidebarOpen && touchStartedInSidebar.current) {
          setSidebarOpen(true)
          touchActive.current = false
        } else if (deltaX < 0 && sidebarOpen && touchStartedInSidebar.current) {
          setSidebarOpen(false)
          touchActive.current = false
        }
      }
    }

    const handleTouchEnd = () => {
      touchStartX.current = null
      touchStartY.current = null
      touchActive.current = false
    }

    document.addEventListener('touchstart', handleTouchStart, { passive: true })
    document.addEventListener('touchmove', handleTouchMove, { passive: true })
    document.addEventListener('touchend', handleTouchEnd)
    document.addEventListener('touchcancel', handleTouchEnd)

    return () => {
      document.removeEventListener('touchstart', handleTouchStart)
      document.removeEventListener('touchmove', handleTouchMove)
      document.removeEventListener('touchend', handleTouchEnd)
      document.removeEventListener('touchcancel', handleTouchEnd)
    }
  }, [sidebarOpen])

  return (
    <div className={`wiki-page-shell ${sidebarOpen ? 'sidebar-open' : 'sidebar-closed'}`}>
      <button
        type="button"
        className={`wiki-toc-backdrop ${sidebarOpen ? 'is-visible' : ''}`}
        aria-label="Close wiki contents"
        onClick={() => setSidebarOpen(false)}
      />
      <aside id="wiki-contents" className="wiki-toc-sidebar" data-open={sidebarOpen ? 'true' : 'false'}>
        <div className="wiki-toc-aside-top">
          <div>
            <p className="wiki-toc-overline">Mahjong Messiah</p>
            <p className="wiki-toc-title">Wiki contents</p>
          </div>
          <button type="button" className="wiki-toc-close" onClick={() => setSidebarOpen(false)} aria-label="Hide wiki contents">×</button>
        </div>
        <div className="wiki-toc-summary">Rules, hand patterns, and tile references in one place.</div>
        <div className="wiki-toc-aside-top">
          <Link href="/" className="wiki-back-link" aria-label="Back to dashboard">
            <span aria-hidden="true">←</span>
            Back to dashboard
          </Link>
        </div>
        <nav className="wiki-toc-list" aria-label="Wiki table of contents">
          {sections.map((section, index) => (
            <a
              key={section.id}
              href={`#${section.id}`}
              onClick={handleTocClick(section.id)}
              aria-current={activeSection === section.id ? 'location' : undefined}
              className={`wiki-toc-link ${activeSection === section.id ? 'active' : ''}`}
            >
              <span className="wiki-toc-number">{String(index + 1).padStart(2, '0')}</span>
              <span>{section.label}</span>
            </a>
          ))}
        </nav>
      </aside>

      <button
        type="button"
        className={`wiki-toc-side-tab ${sidebarOpen ? 'open' : 'closed'}`}
        aria-label={sidebarOpen ? 'Tuck away contents' : 'Open table of contents'}
        aria-controls="wiki-contents"
        aria-expanded={sidebarOpen}
        onClick={() => setSidebarOpen((current) => !current)}
      >
        <span className="wiki-toc-side-icon" aria-hidden="true" />
        <span className="wiki-toc-side-label">Contents</span>
      </button>

      <main className="wiki-page-content">
        <div className="wiki-page-header">
          <div className="wiki-page-hero">
            <p className="wiki-page-kicker">Mahjong hand guide</p>
            <h1>Hong Kong Mahjong Wiki</h1>
            <p className="wiki-page-intro">Explore the rules, scoring patterns, and example hands used in this app so you can quickly identify winning combinations and understand how the score tracker represents each win.</p>
            <div className="wiki-hero-meta" aria-label="Wiki details">
              <span>Scoring reference</span>
              <span>Real tile artwork</span>
              <span>Club rules can vary</span>
            </div>
            <div className="wiki-reference-controls">
              <label htmlFor="wiki-club-select">Show scoring for</label>
              <select id="wiki-club-select" value={selectedClubId ?? ''} onChange={(event) => handleClubChange(event.target.value)}>
                <option value="">General reference</option>
                {clubOptions.map((club) => <option key={club.clubId} value={club.clubId}>{club.clubName} · {club.clubId}</option>)}
              </select>
              <span>{selectedClub ? `Live rules from ${selectedClub.clubName}` : 'The classic reference map is shown until you choose a club.'}</span>
            </div>
          </div>
        </div>

        <section id="scoring-guide" className="wiki-section wiki-scoring-section">
          <div className="wiki-section-heading">
            <p className="wiki-section-kicker">Start here</p>
            <h2>How scoring works</h2>
            <p>This is a scoring reference, not a complete guide to playing Hong Kong Mahjong. Add the fan values for a winning hand, then use the base-point table below.</p>
          </div>
          <div className="wiki-rule-note">
            <strong>House rules are club-specific.</strong>
            <span>New clubs start with a 3-fan minimum, a 13+ cap, and the default map below. A manager can change the fan range and every fan-to-point value in Club settings; this wiki remains a general reference.</span>
          </div>
          <div className="wiki-scoring-grid">
            <article className="wiki-scoring-card wiki-scoring-table-card">
              <div className="wiki-card-heading"><div><p className="wiki-section-kicker">Fan → base points</p><h3>The reference table</h3></div><span className="wiki-card-mark" aria-hidden="true">中</span></div>
              <p>{selectedClub ? 'These values are live for the selected club. Managers can change the range and mapping in Club settings.' : 'Each fan doubles the points through 4 fan. After that, every 2 additional fan doubles the value. 13+ uses the cap.'}</p>
              <div className="wiki-table-wrap">
                <table className="wiki-scoring-table"><caption className="sr-only">Hong Kong Mahjong fan to base points reference</caption><thead><tr><th scope="col">Fan</th><th scope="col">Base points</th></tr></thead><tbody>{displayedFanValues.map((fan) => <tr key={fan}><th scope="row">{selectedClub ? fanLabel(fan, scoringRules) : fan === 13 ? '13+ (limit)' : fan}</th><td>{pointValueForFan(fan)}</td></tr>)}</tbody></table>
              </div>
            </article>
            <div className="wiki-scoring-side">
              <article className="wiki-scoring-card"><p className="wiki-section-kicker">Self draw</p><h3>Everyone pays the hand value</h3><p>The winner receives 3× the base value. Each other player pays 1× the base value.</p><div className="wiki-example"><strong>Example</strong><span>{exampleFanLabel(selfDrawExampleFan)} fan = {selfDrawExamplePoints} base points. Each of the other 3 players pays {selfDrawExamplePoints}.</span></div></article>
              <article className="wiki-scoring-card"><p className="wiki-section-kicker">Win by discard</p><h3>The discarder pays the full penalty</h3><p>Under this app&apos;s default all-paid rule, the discarder pays 2× the base value and the other players pay nothing.</p><div className="wiki-example"><strong>Example</strong><span>{exampleFanLabel(discardExampleFan)} fan = {discardExamplePoints} base points. The discarder pays {discardExamplePoints * 2}.</span></div></article>
            </div>
          </div>
          <div className="wiki-scoring-footnote"><strong>Minimum fan:</strong> 3 fan is common, but beginners may play without a minimum. An alternative table rule is for a self-draw to collect 2× from everyone, while a discard win collects 2× from the discarder and 1× from each other player.</div>
        </section>

        <section id="complete-tile-reference" className="wiki-section wiki-tile-chart-section">
          <div className="wiki-section-heading">
            <h2>Complete tile reference</h2>
            <p>All Mahjong tiles in order, grouped by category. Use this chart to identify the static tile art used across the app.</p>
          </div>
          <div className="wiki-tile-chart">
            {TILE_CATEGORIES.map((category) => (
              <div key={category.heading} className="wiki-tile-chart-group">
                <h3>{category.heading}</h3>
                <p>{category.description}</p>
                <div className="wiki-tile-chart-row compact">
                  {category.ids.map((id) => (
                    <div key={id} className="wiki-tile-chart-item compact">
                      <StaticMahjongTile id={id} size={52} />
                      <span>{mahjongTiles[id].name}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {HAND_SECTIONS.map((section) => (
          <section key={section.heading} id={section.id} className="wiki-section">
            <div className="wiki-section-heading">
              <h2>{section.heading}</h2>
              <p>{section.description}</p>
            </div>
            <div className="wiki-hand-grid">
              {section.hands.map((hand) => (
                <HandExample key={hand.title} {...hand} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
