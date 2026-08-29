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
import {
  WIKI_HAND_SECTIONS,
  WIKI_NAV_SECTIONS,
  HANDBOOK_FAN_TABLE,
  WikiHand,
} from './wiki-content'

const TILE_CATEGORIES = [
  {
    heading: 'Character /  suit',
    description: 'The character suit (萬) is a numbered suit running from 1 through 9.',
    ids: characterTileIds,
  },
  {
    heading: 'Circle / Dots suit',
    description: 'The circle suit (called "Dots" in the handbook) runs from 1 through 9.',
    ids: circleTileIds,
  },
  {
    heading: 'Bamboo / Stick suit',
    description: 'The bamboo suit runs from 1 through 9.',
    ids: bambooTileIds,
  },
  {
    heading: 'Honor tiles',
    description: 'Four winds (East, South, West, North) and three dragons (Red, Green, White Dragon). Note: White Dragon is the blank outlined box. Honors CANNOT form sheungs.',
    ids: honorTileIds,
  },
  {
    heading: 'Flower tiles',
    description: 'Eight bonus tiles in two numbered 1–4 series (Seasons and Flowers). They are separate from the normal 14-tile hand.',
    ids: flowerTileIds,
  },
]

function HandExample({ hand }: { hand: WikiHand }) {
  return (
    <article className="wiki-hand-card">
      <div className="wiki-hand-card-header">
        <div className="wiki-hand-card-title-row">
          <h3>
            {hand.title}
            {hand.nonTraditional && (
              <span className="wiki-hand-tag">Optional / Non-traditional</span>
            )}
          </h3>
          <span className="wiki-hand-value">{hand.value}</span>
        </div>
        <p className="wiki-hand-card-description">{hand.description}</p>
      </div>

      {hand.type === 'standard' || hand.type === 'seven-pairs' ? (
        <div className="wiki-hand-groups-wrap">
          {hand.groups?.map((group, groupIdx) => (
            <div key={groupIdx} className="wiki-hand-tile-group">
              {group.map((tileId, tileIdx) => (
                <StaticMahjongTile key={`${tileId}-${tileIdx}`} id={tileId} size={52} />
              ))}
            </div>
          ))}
        </div>
      ) : hand.type === 'special-flat' || hand.type === 'bonus' ? (
        <div className="wiki-hand-tile-row">
          {hand.tiles && hand.tiles.length > 0 ? (
            hand.tiles.map((tileId, index) => (
              <StaticMahjongTile key={`${tileId}-${index}`} id={tileId} size={52} />
            ))
          ) : (
            <span className="wiki-hand-empty">No bonus flower tiles</span>
          )}
        </div>
      ) : null}

      {hand.note && <div className="wiki-hand-note">{hand.note}</div>}
    </article>
  )
}

export default function WikiPage() {
  const [activeSection, setActiveSection] = useState('mahjong-basics')
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
  const displayedFanValues = selectedClubId ? fanValues(scoringRules) : HANDBOOK_FAN_TABLE.map((row) => row.fan)
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
      : HANDBOOK_FAN_TABLE.find((row) => row.fan === fan)?.points
  const exampleFanLabel = (fan: number) =>
    selectedClub ? fanLabel(fan, scoringRules) : String(fan)
  const selfDrawExampleFan = exampleFan(4)
  const selfDrawExamplePoints = pointValueForFan(selfDrawExampleFan) ?? 0
  const discardExampleFan = exampleFan(7)
  const discardExamplePoints = pointValueForFan(discardExampleFan) ?? 0

  const sectionIds = useMemo(
    () => WIKI_NAV_SECTIONS.filter((section) => !('href' in section && section.href)).map((section) => section.id),
    [],
  )

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
          {WIKI_NAV_SECTIONS.map((section, index) => (
            'href' in section && section.href ? (
              <Link
                key={section.id}
                href={selectedClubId ? `${section.href}?club=${encodeURIComponent(selectedClubId)}` : section.href}
                className="wiki-toc-link"
              >
                <span className="wiki-toc-number">{String(index + 1).padStart(2, '0')}</span>
                <span>{section.label}</span>
              </Link>
            ) : (
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
            )
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
            <p className="wiki-page-intro">Explore the rules, scoring patterns, and example hands based on the Club Scoring Handbook.</p>
            <div className="wiki-hero-meta" aria-label="Wiki details">
              <span>Scoring handbook reference</span>
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

        {/* Section 1: Mahjong Basics */}
        <section id="mahjong-basics" className="wiki-section">
          <div className="wiki-section-heading">
            <p className="wiki-section-kicker">Start here</p>
            <h2>Mahjong basics</h2>
            <p>A quick guide to the fundamental concepts, set definitions, and terminology used in Hong Kong Mahjong.</p>
          </div>

          <div className="wiki-basics-hero-card">
            <h3>The standard winning hand structure</h3>
            <p>
              Most normal winning hands consist of <strong>4 sets + 1 pair = 14 tiles</strong> in hand (before flower replacements or kongs).
            </p>
            <div className="wiki-basics-example-wrap">
              <div className="wiki-basics-example-group">
                <div className="wiki-hand-tile-group">
                  <StaticMahjongTile id="c2" size={52} />
                  <StaticMahjongTile id="c3" size={52} />
                  <StaticMahjongTile id="c4" size={52} />
                </div>
                <span className="wiki-basics-label">Sheung (Set 1)</span>
              </div>
              <div className="wiki-basics-example-group">
                <div className="wiki-hand-tile-group">
                  <StaticMahjongTile id="b4" size={52} />
                  <StaticMahjongTile id="b5" size={52} />
                  <StaticMahjongTile id="b6" size={52} />
                </div>
                <span className="wiki-basics-label">Sheung (Set 2)</span>
              </div>
              <div className="wiki-basics-example-group">
                <div className="wiki-hand-tile-group">
                  <StaticMahjongTile id="o6" size={52} />
                  <StaticMahjongTile id="o7" size={52} />
                  <StaticMahjongTile id="o8" size={52} />
                </div>
                <span className="wiki-basics-label">Sheung (Set 3)</span>
              </div>
              <div className="wiki-basics-example-group">
                <div className="wiki-hand-tile-group">
                  <StaticMahjongTile id="red" size={52} />
                  <StaticMahjongTile id="red" size={52} />
                  <StaticMahjongTile id="red" size={52} />
                </div>
                <span className="wiki-basics-label">Pong (Set 4)</span>
              </div>
              <div className="wiki-basics-example-group">
                <div className="wiki-hand-tile-group">
                  <StaticMahjongTile id="east" size={52} />
                  <StaticMahjongTile id="east" size={52} />
                </div>
                <span className="wiki-basics-label">Pair</span>
              </div>
            </div>
          </div>

          <div className="wiki-basics-terms-grid">
            <div className="wiki-basics-term-card">
              <h4>Sheung / Chow (Sequence)</h4>
              <p>3 consecutive numbered tiles in the same suit (e.g. 2-3-4 of Characters). Honors cannot make sheungs.</p>
            </div>
            <div className="wiki-basics-term-card">
              <h4>Pong (Triplet)</h4>
              <p>3 identical tiles (e.g. 3 Red Dragons or 3 Five of Circles).</p>
            </div>
            <div className="wiki-basics-term-card">
              <h4>Kong</h4>
              <p>4 identical tiles. Counts as 1 set; a replacement tile is immediately drawn from the wall.</p>
            </div>
            <div className="wiki-basics-term-card">
              <h4>Pair</h4>
              <p>2 identical tiles forming the required eyes/head of the hand.</p>
            </div>
            <div className="wiki-basics-term-card">
              <h4>Honor tiles</h4>
              <p>The four Winds (East, South, West, North) and three Dragons (Red, Green, White). Honors CANNOT form sheungs.</p>
            </div>
            <div className="wiki-basics-term-card">
              <h4>Terminal</h4>
              <p>A 1 or 9 tile from any of the three numbered suits (Characters, Circles/Dots, Bamboo).</p>
            </div>
            <div className="wiki-basics-term-card">
              <h4>Flowers</h4>
              <p>Bonus tiles drawn and set aside; they do not count toward the normal 14-tile hand structure.</p>
            </div>
            <div className="wiki-basics-term-card">
              <h4>Concealed / Wall</h4>
              <p>Tiles drawn yourself from the undrawn wall without calling another player&apos;s discard.</p>
            </div>
            <div className="wiki-basics-term-card">
              <h4>Seat Wind & Round Wind</h4>
              <p>The wind assigned to your seat (East=1, South=2, West=3, North=4) and the prevailing wind of the current round.</p>
            </div>
            <div className="wiki-basics-term-card">
              <h4>Fan & Limit</h4>
              <p><strong>Fan</strong> is the scoring unit earned by completing patterns. <strong>Limit</strong> is the maximum scoring category (cap).</p>
            </div>
          </div>
        </section>

        {/* Section 2: Complete Tile Reference */}
        <section id="complete-tile-reference" className="wiki-section wiki-tile-chart-section">
          <div className="wiki-section-heading">
            <h2>Complete tile reference</h2>
            <p>All Mahjong tiles in order, grouped by category. Use this chart to identify tile art across the app.</p>
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

        {/* Section 3: How Scoring Works */}
        <section id="scoring-guide" className="wiki-section wiki-scoring-section">
          <div className="wiki-section-heading">
            <h2>How scoring works</h2>
            <p>Understand how fan values accumulate and convert into base points under the Club Scoring Handbook.</p>
          </div>

          <div className="wiki-scoring-steps">
            <div className="wiki-step-card">
              <span className="wiki-step-num">1</span>
              <div>
                <h4>Build a valid hand</h4>
                <p>Form 4 sets + 1 pair (or a special hand pattern like Thirteen Orphans or Seven Pairs).</p>
              </div>
            </div>
            <div className="wiki-step-card">
              <span className="wiki-step-num">2</span>
              <div>
                <h4>Calculate fan</h4>
                <p>Add up the fan for every qualifying pattern and bonus, respecting handbook exclusions.</p>
                <Link
                  href={selectedClubId ? `/wiki/score?club=${encodeURIComponent(selectedClubId)}` : '/wiki/score'}
                  className="wiki-score-calculator-link"
                >
                  Open Score Calculator
                </Link>
              </div>
            </div>
            <div className="wiki-step-card">
              <span className="wiki-step-num">3</span>
              <div>
                <h4>Convert fan to points</h4>
                <p>Lookup the base points for your total fan, then apply self-draw or discard payment rules.</p>
              </div>
            </div>
          </div>

          <div className="wiki-rule-note">
            <strong>Key Handbook Scoring Rules:</strong>
            <ul className="wiki-rule-list">
              <li><strong>Fan vs. Points:</strong> Fan is the scoring count earned; points are the resulting payout. Multiple patterns stack unless excluded.</li>
              <li><strong>Limit:</strong> The maximum scoring category (cap) specified by the table or club.</li>
              <li><strong>House Rules & Minimum Fan:</strong> A 3-fan minimum is common at established tables, but the handbook recommends no minimum when teaching beginners.</li>
            </ul>
          </div>

          <div className="wiki-scoring-grid">
            <article className="wiki-scoring-card wiki-scoring-table-card">
              <div className="wiki-card-heading">
                <div>
                  <p className="wiki-section-kicker">Fan → base points</p>
                  <h3>The reference table</h3>
                </div>
                <span className="wiki-card-mark" aria-hidden="true">中</span>
              </div>
              <p>{selectedClub ? 'These values are live for the selected club.' : 'Each fan doubles points up to 4 fan. After that, every 2 fan doubles the value. 13+ is the Limit cap.'}</p>
              <div className="wiki-table-wrap">
                <table className="wiki-scoring-table">
                  <caption className="sr-only">Hong Kong Mahjong fan to base points reference</caption>
                  <thead>
                    <tr>
                      <th scope="col">Fan</th>
                      <th scope="col">Base points</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedFanValues.map((fan) => (
                      <tr key={fan}>
                        <th scope="row">{selectedClub ? fanLabel(fan, scoringRules) : fan === 13 ? '13+ (limit)' : fan}</th>
                        <td>{pointValueForFan(fan)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </article>

            <div className="wiki-scoring-side">
              <article className="wiki-scoring-card">
                <p className="wiki-section-kicker">Self draw</p>
                <h3>Everyone pays the base value</h3>
                <p>Under the handbook rules, each of the other 3 players pays 1× the base value (total 3× base points to the winner).</p>
                <div className="wiki-example">
                  <strong>Example</strong>
                  <span>{exampleFanLabel(selfDrawExampleFan)} fan = {selfDrawExamplePoints} base points. Each of the other 3 players pays {selfDrawExamplePoints}.</span>
                </div>
              </article>

              <article className="wiki-scoring-card">
                <p className="wiki-section-kicker">Win by discard</p>
                <h3>Discarder pays 2× penalty</h3>
                <p>Under the default all-paid rule, the discarder pays 2× the base value; the other two players pay 0.</p>
                <div className="wiki-example">
                  <strong>Example</strong>
                  <span>{exampleFanLabel(discardExampleFan)} fan = {discardExamplePoints} base points. The discarder pays {discardExamplePoints * 2}.</span>
                </div>
              </article>
            </div>
          </div>

          <div className="wiki-scoring-footnote">
            <strong>Alternative Table Rule:</strong> An optional table rule collects 2× from everyone on a self-draw, and 2× from the discarder + 1× from each other player on a discard win.
          </div>
        </section>

        {/* Hand sections 4 through 11 */}
        {WIKI_HAND_SECTIONS.map((section) => (
          <section key={section.heading} id={section.id} className="wiki-section">
            <div className="wiki-section-heading">
              <h2>{section.heading}</h2>
              <p>{section.description}</p>
            </div>
            <div className="wiki-hand-grid">
              {section.hands.map((hand) => (
                <HandExample key={hand.title} hand={hand} />
              ))}
            </div>
          </section>
        ))}
      </main>
    </div>
  )
}
