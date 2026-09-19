'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { StaticMahjongTile, type MahjongTileId } from '@/components/MahjongTile'
import './login-feature-showcase.css'

type FeatureId = 'session' | 'calculator' | 'standings' | 'clubs'

const FEATURES: {
  id: FeatureId
  tab: string
  kicker: string
  title: string
  body: string
  beats: string[]
  videoSrc: string
}[] = [
  {
    id: 'session',
    tab: 'Session',
    kicker: '01 · Live night',
    title: 'Score from the felt—or your phone.',
    body: 'Run the night on the club session board, then open a focused table for wind tracking, seat winds, and dealer rotation. Print or share table QR codes for check-in, and tap Winner or Calculate fan to add a score in seconds.',
    beats: ['Focused winds', 'Table QR check-in', 'Quick win / fan'],
    videoSrc: '/feature-reels/session.mp4?v=4',
  },
  {
    id: 'calculator',
    tab: 'Calculator',
    kicker: '02 · Fan math',
    title: 'Calculate fan the way the handbook describes it.',
    body: 'Build the finished hand tile by tile. Melds group automatically, mark open or concealed, and watch patterns stack under your club’s house rules—or use Hand helper mid-hand.',
    beats: ['Thirteen Orphans', 'Detect limit', 'Apply fan'],
    videoSrc: '/feature-reels/calculator.mp4?v=3',
  },
  {
    id: 'standings',
    tab: 'Analytics',
    kicker: '03 · Rivalries',
    title: 'Standings, Skill, and the story behind every table.',
    body: 'Leaderboards recalculate from season games. Dig into club pulse, player deep dive, session windows, score and Skill charts, game logs, and the player network of who shared a table.',
    beats: ['Leaderboard + Skill', 'Deep dive & charts', 'Logs & network'],
    videoSrc: '/feature-reels/standings.mp4?v=3',
  },
  {
    id: 'clubs',
    tab: 'Clubs',
    kicker: '04 · Club ops',
    title: 'Manage every club from one dashboard.',
    body: 'Create or join multiple clubs, keep rosters and account links tidy, approve join requests, and run admin tools—house scoring, seasons, tournaments, titles, activity windows, and access—without leaving the workspace.',
    beats: ['Multi-club home', 'Roster & requests', 'Settings & seasons'],
    videoSrc: '/feature-reels/clubs.mp4?v=3',
  },
]

const DEMO_HAND: MahjongTileId[] = [
  'c1', 'c9', 'b1', 'b9', 'o1', 'o9',
  'east', 'south', 'west', 'north',
  'red', 'green', 'white',
  'c1',
]

const DEMO_SESSION_PLAYERS = [
  { wind: 'East', name: 'Mei', emoji: '🐉' },
  { wind: 'South', name: 'Jordan', emoji: '🀄' },
  { wind: 'West', name: 'Sam', emoji: '🎴' },
  { wind: 'North', name: 'Calvin', emoji: '🐼' },
] as const

function DemoSession() {
  return (
    <div className="lfs-demo lfs-demo-session" aria-hidden="true">
      <div className="lfs-demo-chrome">
        <span>Focused · Table 1</span>
        <span className="lfs-demo-pill">Wind tracker</span>
      </div>
      <div className="lfs-wind-row">
        <div className="lfs-wind-chip">
          <em>Round</em>
          <strong className="lfs-round-wind">East</strong>
        </div>
        <div className="lfs-wind-chip">
          <em>Dealer</em>
          <strong className="lfs-dealer">Seat 1</strong>
        </div>
        <div className="lfs-wind-chip lfs-qr-chip">
          <em>Check-in</em>
          <strong>QR</strong>
        </div>
      </div>
      <div className="lfs-demo-seats lfs-demo-seats-compact">
        {DEMO_SESSION_PLAYERS.map((player, index) => (
          <div key={player.wind} className={`lfs-seat lfs-seat-${index + 1}`}>
            <em>{player.wind}</em>
            <strong className="lfs-seat-name">
              <span className="lfs-seat-emoji">{player.emoji}</span>
              {player.name}
            </strong>
          </div>
        ))}
      </div>
      <div className="lfs-demo-actions">
        <span className="lfs-action-draw">Draw</span>
        <span className="lfs-action-win">+ Record win</span>
        <span className="lfs-action-calc">Calculate fan</span>
      </div>
      <div className="lfs-demo-toast">+32 · Self-draw · 6 fan</div>
    </div>
  )
}

function DemoCalculator() {
  return (
    <div className="lfs-demo lfs-demo-calc" aria-hidden="true">
      <div className="lfs-demo-chrome">
        <span>Score calculator</span>
        <span className="lfs-demo-pill">Thirteen Orphans</span>
      </div>
      <div className="lfs-calc-tiles lfs-calc-tiles-real">
        {DEMO_HAND.map((id, index) => (
          <span key={`${id}-${index}`} className={`lfs-tile lfs-tile-real lfs-tile-${index + 1}`}>
            <StaticMahjongTile id={id} size={36} />
          </span>
        ))}
      </div>
      <div className="lfs-calc-result">
        <div>
          <p>Total fan</p>
          <strong className="lfs-fan-number lfs-fan-limit" />
        </div>
        <ul className="lfs-pattern-list">
          <li>Thirteen Orphans</li>
          <li>Limit hand</li>
          <li>1+9 each suit</li>
          <li>All honors + pair</li>
        </ul>
      </div>
    </div>
  )
}

function DemoStandings() {
  return (
    <div className="lfs-demo lfs-demo-standings" aria-hidden="true">
      <div className="lfs-demo-chrome">
        <span>Analytics</span>
        <span className="lfs-demo-pill">Club pulse</span>
      </div>
      <div className="lfs-analytics-metrics">
        <div className="lfs-metric lfs-metric-1">
          <em>Games</em>
          <strong>48</strong>
        </div>
        <div className="lfs-metric lfs-metric-2">
          <em>Win rate</em>
          <strong>28%</strong>
        </div>
        <div className="lfs-metric lfs-metric-3">
          <em>Skill Δ</em>
          <strong>+64</strong>
        </div>
      </div>
      <ol className="lfs-standings-rows">
        {[
          { name: 'Calvin', pts: '+128', skill: '1837' },
          { name: 'Mei', pts: '+96', skill: '1712' },
          { name: 'Jordan', pts: '+41', skill: '1640' },
        ].map((row, index) => (
          <li key={row.name} className={`lfs-standing-row lfs-standing-${index + 1}`}>
            <span>#{index + 1}</span>
            <strong>{row.name}</strong>
            <em>{row.pts}</em>
            <b>{row.skill}</b>
          </li>
        ))}
      </ol>
      <div className="lfs-analytics-tags">
        <span>Deep dive</span>
        <span>Game logs</span>
        <span>Network</span>
        <span>Session window</span>
      </div>
    </div>
  )
}

function DemoClubs() {
  return (
    <div className="lfs-demo lfs-demo-clubs" aria-hidden="true">
      <div className="lfs-demo-chrome">
        <span>Your clubs</span>
        <span className="lfs-demo-pill">3 active</span>
      </div>
      <div className="lfs-club-cards">
        {[
          { name: 'Friday Night', role: 'Manager', id: 'GEUX7Z' },
          { name: 'Southside', role: 'Member', id: 'ZC8K25' },
          { name: 'Weekend Open', role: 'Manager', id: 'AB12CD' },
        ].map((club, index) => (
          <div key={club.id} className={`lfs-club-card lfs-club-${index + 1}`}>
            <strong>{club.name}</strong>
            <em>{club.role}</em>
            <span>{club.id}</span>
          </div>
        ))}
      </div>
      <div className="lfs-admin-tools">
        <span>Roster</span>
        <span>Join requests</span>
        <span>House scoring</span>
        <span>Seasons</span>
        <span>Titles</span>
        <span>Access</span>
      </div>
    </div>
  )
}

function FeatureReel({
  feature,
  active,
  recording,
}: {
  feature: (typeof FEATURES)[number]
  active: boolean
  recording: boolean
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const Demo =
    feature.id === 'session'
      ? DemoSession
      : feature.id === 'calculator'
        ? DemoCalculator
        : feature.id === 'standings'
          ? DemoStandings
          : DemoClubs

  useEffect(() => {
    const video = videoRef.current
    if (!video || recording) return
    if (active) {
      void video.play().catch(() => undefined)
    } else {
      video.pause()
      video.currentTime = 0
    }
  }, [active, recording])

  return (
    <article
      className={`lfs-feature${active ? ' is-active' : ''}`}
      data-feature={feature.id}
      aria-hidden={!active}
    >
      <div className="lfs-feature-copy">
        <p className="lfs-kicker">{feature.kicker}</p>
        <h3>{feature.title}</h3>
        <p className="lfs-body">{feature.body}</p>
        <ol className="lfs-beats">
          {feature.beats.map((beat, index) => (
            <li key={beat}>
              <span>{String(index + 1).padStart(2, '0')}</span>
              {beat}
            </li>
          ))}
        </ol>
      </div>
      <div className="lfs-reel">
        <div className="lfs-reel-frame">
          {!recording ? (
            <video
              ref={videoRef}
              className="lfs-reel-video"
              src={feature.videoSrc}
              muted
              playsInline
              loop
              preload="metadata"
              aria-label={`${feature.title}. Silent product demo: ${feature.beats.join(', ')}. See the text beside this video for a full description.`}
            />
          ) : null}
          <div className="lfs-reel-fallback">
            <Demo />
          </div>
        </div>
        <p className="sr-only">
          Video transcript: {feature.body} Highlights: {feature.beats.join('; ')}.
        </p>
        <div className="lfs-reel-progress" aria-hidden="true">
          <i />
        </div>
      </div>
    </article>
  )
}

export default function LoginFeatureShowcase() {
  const labelId = useId()
  const [activeIndex, setActiveIndex] = useState(0)
  const [paused, setPaused] = useState(false)
  const [recording, setRecording] = useState(false)
  const reduceMotion = useRef(false)

  useEffect(() => {
    reduceMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const params = new URLSearchParams(window.location.search)
    setRecording(params.get('record') === '1')
  }, [])

  useEffect(() => {
    if (paused || reduceMotion.current || recording) return
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % FEATURES.length)
    }, 6500)
    return () => window.clearInterval(timer)
  }, [paused, recording])

  return (
    <section className="lfs" id="how-it-works" aria-labelledby={labelId}>
      <div className="lfs-shell">
        <header className="lfs-header">
          <p className="lfs-kicker">How it works</p>
          <h2 id={labelId}>From the live table to club standings—and every tool in between.</h2>
          <p className="lfs-lede">
            Sessions with wind tracking and QR check-in, handbook-accurate fan math, analytics that
            go deeper than a leaderboard, and full club management across every group you play with.
          </p>
        </header>

        <div
          className="lfs-stage"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          onFocusCapture={() => setPaused(true)}
          onBlurCapture={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setPaused(false)
          }}
        >
          <div
            className="lfs-tabs"
            role="tablist"
            aria-label="Feature demos"
            onKeyDown={(event) => {
              const last = FEATURES.length - 1
              let next: number | null = null
              if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
                next = activeIndex === last ? 0 : activeIndex + 1
              } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
                next = activeIndex === 0 ? last : activeIndex - 1
              } else if (event.key === 'Home') {
                next = 0
              } else if (event.key === 'End') {
                next = last
              }
              if (next === null) return
              event.preventDefault()
              setActiveIndex(next)
              const tab = event.currentTarget.querySelector<HTMLElement>(
                `#${CSS.escape(`${labelId}-tab-${FEATURES[next].id}`)}`,
              )
              tab?.focus()
            }}
          >
            {FEATURES.map((feature, index) => (
              <button
                key={feature.id}
                type="button"
                role="tab"
                id={`${labelId}-tab-${feature.id}`}
                aria-selected={index === activeIndex}
                aria-controls={`${labelId}-panel-${feature.id}`}
                tabIndex={index === activeIndex ? 0 : -1}
                className={index === activeIndex ? 'is-active' : undefined}
                onClick={() => setActiveIndex(index)}
              >
                <span>{feature.kicker.split('·')[0].trim()}</span>
                {feature.tab}
              </button>
            ))}
          </div>

          <div className="lfs-panels">
            {FEATURES.map((feature, index) => (
              <div
                key={feature.id}
                id={`${labelId}-panel-${feature.id}`}
                role="tabpanel"
                aria-labelledby={`${labelId}-tab-${feature.id}`}
                hidden={index !== activeIndex}
              >
                <FeatureReel feature={feature} active={index === activeIndex} recording={recording} />
              </div>
            ))}
          </div>
        </div>

        <div className="lfs-grid" aria-label="More product capabilities">
          <article>
            <h3>Multi-club dashboard</h3>
            <p>Keep every group in one place. Open a club, create one, or join with a six-character code.</p>
          </article>
          <article>
            <h3>House rules & seasons</h3>
            <p>Fan ranges, base points, titles, and tournaments stay per club—managers set them once.</p>
          </article>
          <article>
            <h3>Guest table scoring</h3>
            <p>Try it with a club code when a session is live. Upgrade later to keep history on your account.</p>
          </article>
          <article>
            <h3>Offline-safe recording</h3>
            <p>Games queue when the network blips, then sync when you are back—so the night never stalls.</p>
          </article>
        </div>

        <p className="lfs-foot">
          After sign-in, open <strong>Ming</strong> in the header anytime for a guided tour of the live workspace.
        </p>
      </div>
    </section>
  )
}
