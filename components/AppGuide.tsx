'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { claimMingWelcome } from '@/lib/data'

const FAN_POINTS = [
  [3, 8], [4, 16], [5, 24], [6, 32], [7, 48], [8, 64],
  [9, 96], [10, 128], [11, 192], [12, 256], [13, 384], ['13+', 384]
] as const

const GUIDE_SECTIONS = [
  { icon: '🏠', title: 'Start on your dashboard', body: 'Your personal dashboard combines your play across every club. Review overall games, win rate, recent Skill movement, memberships, and the player profile linked to your account in each club.' },
  { icon: '🀄', title: 'Clubs', body: 'A club is a shared roster, game history, and set of standings for one mahjong group. Open one of your clubs, create a new club, or join an existing club using its six-character club ID. Creating and joining are separate: the creation limit does not restrict clubs you join or manage.' },
  { icon: '👥', title: 'Roster and account links', body: 'The roster contains the player profiles used in games. A signed-in member can link their account to one unlinked player profile, and can unlink it later. Managers can add, rename, remove, or change player emojis, and can promote other club members to manager.' },
  { icon: '📅', title: 'What is a Season?', body: 'A season is a chapter of club standings. Starting a new season closes the current live session and gives the leaderboard a fresh set of season statistics, while keeping earlier seasons and game history available to review.' },
  { icon: '📋', title: 'What is a Session?', body: 'A session is a single mahjong night. You choose which players are attending and how many tables are running. The session tracks who is seated where and records all games played during the night.' },
  { icon: '🔢', title: 'Number of Tables', body: 'Set how many tables will be running simultaneously. Each table seats exactly 4 players. You can have as many tables as you need.' },
  { icon: '🧑‍🤝‍🧑', title: 'Selecting Players', body: 'Choose all players attending tonight. Anyone not selected won’t appear in the session. You need at least 4 players to start. Use the search bar to find players quickly.' },
  { icon: '🪑', title: 'Sideline', body: 'Players who are attending but not currently seated at a table sit on the sideline. Drag them to a table when they’re ready to play, or drag them back to the sideline between rounds.' },
  { icon: '🎴', title: 'Recording a Game', body: 'Once a table has 4 players it shows ✓ Ready. After a game finishes, tap Winner... to record who won, the win type (self-draw or discard), and the fan count. Or tap Draw if no one won.' },
  { icon: '🧮', title: 'Fan Scoring', body: 'Scores are based on fan count (3–13+). Self-draw: the winner gets 3× base and each loser pays 1× base. Discard win: the winner gets 2× base, the discarder pays 2× base, and the other players pay nothing.', fanMap: true },
  { icon: '⚙️', title: 'Edit / Clear All Tables / Reset', body: 'Edit lets you change which players are in the session or the number of tables. Clear All Tables moves everyone back to the sideline without ending the session. Reset Session wipes everything and starts fresh.' },
  { icon: '🏆', title: 'Standings', body: 'The leaderboard recalculates from the selected season’s game records. Points preserve raw scores, while Skill estimates playing strength with experience and uncertainty built in.' },
  { icon: '📈', title: 'Analytics', body: 'Analytics shows score and Skill movement over time. Its Metric Definitions link explains every number in plain language.' },
  { icon: '🗂️', title: 'Game logs', body: 'Game logs are the record-level source of truth, with newest games first. Filter by session players, all data, or one player. Managers can select a record to correct or delete it; standings and analytics then recalculate.' },
  { icon: '🕸️', title: 'Player Network', body: 'Network shows who shared a table and how often. Filter by season and date range, focus on one player (ego), and switch between the graph and a sortable table. With a player selected, node color shows net points exchanged with that player.' },
  { icon: '🔐', title: 'Club settings and managers', body: 'Settings contains season controls, join requests, manager access, navigation, and—where permitted—club deletion. Manager-only actions stay hidden or disabled for regular members.' }
] as const

type TourAction = 'next' | 'click' | 'responsive' | 'finish'
type TourStep = {
  selector: string
  title: string
  body: string
  action: TourAction
  clickTarget?: string
  intermediateTarget?: string
  instruction?: string
}

const TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="dashboard-intro"]', title: 'Your personal dashboard', body: 'This is your starting point after sign-in. It keeps your clubs and personal results together without changing any club data.', action: 'next' },
  { selector: '[data-tour="dashboard-performance"]', title: 'Your performance at a glance', body: 'These totals combine the player profiles linked to your account across clubs: games, win rate, recent Skill movement, and memberships.', action: 'next' },
  { selector: '[data-tour="clubs-list"]', title: 'Your clubs', body: 'Each card opens a real club and shows your linked player summary. The universal club is available to first-time users too.', action: 'next' },
  { selector: '[data-tour="club-actions"]', title: 'Create or join', body: 'Create a club for a new group, or join an existing one with its club ID. The tour will not submit either form.', action: 'next' },
  { selector: '[data-tour="open-club"]', title: 'Open a real club', body: 'Choose a club you already belong to. Ming will stay with you while the actual club workspace loads.', action: 'click', instruction: 'Click the highlighted Open club or Open roster button.' },
  { selector: '[data-tour="club-header"]', title: 'The club workspace', body: 'This header identifies the current club and keeps its season, roster, analytics, game logs, player network, share ID, and manager settings together.', action: 'next' },
  { selector: '[data-tour="season-selector"]', title: 'Seasons are chapters', body: 'Switch seasons to review a different chapter of standings and history. Starting a new season is a manager action in Settings; the tour will not change it.', action: 'next' },
  { selector: '[data-tour="session-manager"]', title: 'Run the live session here', body: 'Choose attendees and tables, seat players from the sideline, then record a winner or draw. Four players make a table ready. Ming will not start a session or record a game.', action: 'next' },
  { selector: '[data-tour="roster-open"], [data-tour="roster-tab"]', clickTarget: 'roster-open', intermediateTarget: 'roster-tab', title: 'Open the real roster', body: 'The roster manages tracked players, account links, emojis, names, and manager access. On mobile, open the Roster tab first, then use Manage players.', action: 'responsive', instruction: 'On mobile, tap Roster and then Manage players. On desktop, click Roster.' },
  { selector: '[data-tour="roster-modal"]', title: 'Roster and linked users', body: 'Members can link themselves to one available player. Managers also see player and manager controls. Nothing is changed unless you deliberately use one of those controls.', action: 'next' },
  { selector: '[data-tour="roster-close"]', title: 'Return to the workspace', body: 'Close the real roster to continue.', action: 'click', instruction: 'Click Close.' },
  { selector: '[data-tour="leaderboard"], [data-tour="standings-tab"]', clickTarget: 'standings-tab', title: 'Standings update from games', body: 'Points, Skill, activity, and results are recalculated for the selected season. On mobile, open the Standings tab to reveal the same leaderboard.', action: 'responsive', instruction: 'On mobile, click Standings. On desktop, choose Next.' },
  { selector: '[data-tour="analytics-open"]', title: 'Open real analytics', body: 'Analytics lets you compare selected players across score and Skill history.', action: 'click', instruction: 'Click Analytics.' },
  { selector: '[data-tour="analytics-modal"]', title: 'Explore club trends', body: 'Use the real filters to focus on session players, clear the selection, choose specific players, and change the game range. The horizontal axis uses game dates.', action: 'next' },
  { selector: '[data-tour="analytics-close"]', title: 'Return to the workspace', body: 'Close analytics when you are finished reviewing trends.', action: 'click', instruction: 'Click Close.' },
  { selector: '[data-tour="logs-open"]', title: 'Open the real game logs', body: 'Game logs provide the detailed history behind standings and analytics.', action: 'click', instruction: 'Click Game logs.' },
  { selector: '[data-tour="logs-modal"]', title: 'Review the source of truth', body: 'Games appear newest first. Filter the list, switch card or table view on desktop, and load older records when needed. Manager edits and deletes recalculate derived statistics.', action: 'next' },
  { selector: '[data-tour="logs-close"]', title: 'Return to the workspace', body: 'Close the game logs to continue exploring club tools.', action: 'click', instruction: 'Click Close.' },
  { selector: '[data-tour="network-open"]', title: 'Open the player network', body: 'Network shows who played with whom and how points flowed between players.', action: 'click', instruction: 'Click Network.' },
  { selector: '[data-tour="network-modal"]', title: 'Who plays with whom', body: 'Edges connect players who shared a table; thickness is shared games. Filter by season and date, pick an ego player for net points coloring, and switch to the sortable table when you want exact values. Ming will not change any filters for you.', action: 'next' },
  { selector: '[data-tour="network-close"]', title: 'Return to the workspace', body: 'Close the network to finish with club administration.', action: 'click', instruction: 'Click Close.' },
  { selector: '[data-tour="settings-open"]', title: 'Open real club settings', body: 'Club settings contains manager and season controls plus a route back to your dashboard.', action: 'click', instruction: 'Click the highlighted Club settings button.' },
  { selector: '[data-tour="settings-modal"]', title: 'You know the core workflow', body: 'Settings is where managers start seasons and perform sensitive club actions. Ming never clicks those actions, and this tour has made no data writes.', action: 'finish', instruction: 'Finish returns you safely to your dashboard.' }
]

export const TOUR_STEP_COUNT = TOUR_STEPS.length

type SpotlightRect = { top: number; left: number; width: number; height: number }

function isVisible(element: HTMLElement) {
  const rect = element.getBoundingClientRect()
  const style = window.getComputedStyle(element)
  return rect.width > 0 && rect.height > 0 && style.display !== 'none' && style.visibility !== 'hidden'
}

function visibleTarget(selector: string) {
  return Array.from(document.querySelectorAll<HTMLElement>(selector)).find(isVisible) ?? null
}

function paddedRect(element: HTMLElement): SpotlightRect {
  const rect = element.getBoundingClientRect()
  const padding = 8
  const left = Math.max(6, rect.left - padding)
  const top = Math.max(6, rect.top - padding)
  return {
    left,
    top,
    width: Math.min(window.innerWidth - left - 6, rect.width + padding * 2),
    height: Math.min(window.innerHeight - top - 6, rect.height + padding * 2)
  }
}

export default function AppGuide() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [welcomeSpotlight, setWelcomeSpotlight] = useState<SpotlightRect | null>(null)
  const [guideOpen, setGuideOpen] = useState(false)
  const [tourOpen, setTourOpen] = useState(false)
  const [stepIndex, setStepIndex] = useState(0)
  const [spotlight, setSpotlight] = useState<SpotlightRect | null>(null)
  const targetRef = useRef<HTMLElement | null>(null)
  const helpButtonRef = useRef<HTMLButtonElement | null>(null)
  const welcomeClaimRef = useRef<string | null>(null)
  const bubbleRef = useRef<HTMLElement | null>(null)
  const lastScrolledRef = useRef<HTMLElement | null>(null)
  const allowProgrammaticTourClickRef = useRef(false)
  const step = TOUR_STEPS[stepIndex]

  useEffect(() => setMounted(true), [])

  useEffect(() => {
    if (!mounted || loading || !user || welcomeClaimRef.current === user.uid) return
    welcomeClaimRef.current = user.uid
    void claimMingWelcome(user.uid).then((firstVisit) => {
      if (firstVisit) setWelcomeOpen(true)
    }).catch(() => { /* A welcome failure must never block the app. */ })
  }, [loading, mounted, user])

  useEffect(() => {
    if (!welcomeOpen) { setWelcomeSpotlight(null); return }
    const update = () => { if (helpButtonRef.current) setWelcomeSpotlight(paddedRect(helpButtonRef.current)) }
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [welcomeOpen])

  useEffect(() => {
    if (!guideOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [guideOpen])

  const advance = useCallback(() => {
    setStepIndex((current) => Math.min(current + 1, TOUR_STEPS.length - 1))
  }, [])

  const clickTourElement = useCallback((tourName: string) => {
    const element = visibleTarget(`[data-tour="${tourName}"]`)
    if (!element) return
    allowProgrammaticTourClickRef.current = true
    element.click()
    allowProgrammaticTourClickRef.current = false
  }, [])

  const goBack = useCallback(() => {
    if (stepIndex === 0) return

    // Restore UI that a forward-only step changed before returning to its control.
    if (stepIndex === 5) router.push('/')
    if (stepIndex === 9) clickTourElement('roster-close')
    if (stepIndex === 11) clickTourElement('roster-open')
    if (stepIndex === 13) clickTourElement('analytics-close')
    if (stepIndex === 16) clickTourElement('logs-close')
    if (stepIndex === 19) clickTourElement('network-close')
    if (stepIndex === 22) clickTourElement('settings-close')

    setStepIndex((current) => Math.max(0, current - 1))
  }, [clickTourElement, router, stepIndex])

  const exitTour = useCallback(() => {
    setTourOpen(false)
    setStepIndex(0)
    setSpotlight(null)
    targetRef.current = null
    lastScrolledRef.current = null
    router.push('/')
  }, [router])

  useEffect(() => {
    if (!tourOpen) return
    const handleEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') exitTour() }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [exitTour, tourOpen])

  useEffect(() => {
    if (!tourOpen || !step) return
    let frame = 0
    const update = () => {
      const clickTarget = step.action === 'responsive' && step.clickTarget
        ? visibleTarget(`[data-tour="${step.clickTarget}"]`)
        : null
      const target = clickTarget ?? visibleTarget(step.selector)
      targetRef.current = target
      if (!target) {
        setSpotlight(null)
        return
      }
      if (lastScrolledRef.current !== target) {
        lastScrolledRef.current = target
        const reducedMotion = typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        target.scrollIntoView({ block: 'center', inline: 'nearest', behavior: reducedMotion ? 'auto' : 'smooth' })
      }
      const next = paddedRect(target)
      setSpotlight((current) => current && current.top === next.top && current.left === next.left && current.width === next.width && current.height === next.height ? current : next)
    }

    lastScrolledRef.current = null
    const mutationObserver = new MutationObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    })
    mutationObserver.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class', 'style', 'data-tour'] })
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    const retry = window.setInterval(update, 500)
    frame = requestAnimationFrame(update)
    return () => {
      cancelAnimationFrame(frame)
      window.clearInterval(retry)
      mutationObserver.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [step, tourOpen])

  const targetRequiresClick = (() => {
    if (!step || !targetRef.current) return false
    if (step.action === 'click') return true
    return step.action === 'responsive' && [step.clickTarget, step.intermediateTarget].includes(targetRef.current.dataset.tour)
  })()

  const targetAdvancesOnClick = (() => {
    if (!step || !targetRef.current) return false
    if (step.action === 'click') return true
    return step.action === 'responsive' && targetRef.current.dataset.tour === step.clickTarget
  })()

  useEffect(() => {
    if (!tourOpen || !targetAdvancesOnClick || !step) return
    const handleClick = (event: MouseEvent) => {
      const target = targetRef.current
      if (!target || !(event.target instanceof Node) || !target.contains(event.target)) return
      window.setTimeout(advance, 220)
    }
    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [advance, step, targetAdvancesOnClick, tourOpen])

  useEffect(() => {
    if (!tourOpen) return

    const isAllowed = (eventTarget: EventTarget | null) => {
      if (allowProgrammaticTourClickRef.current) return true
      if (!(eventTarget instanceof Node)) return false
      return Boolean(targetRef.current?.contains(eventTarget) || bubbleRef.current?.contains(eventTarget))
    }
    const blockOutsideInteraction = (event: Event) => {
      if (isAllowed(event.target)) return
      event.preventDefault()
      event.stopPropagation()
      if ('stopImmediatePropagation' in event) event.stopImmediatePropagation()
    }
    const blockOutsideKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape' || event.key === 'Tab' || isAllowed(event.target)) return
      event.preventDefault()
      event.stopPropagation()
      event.stopImmediatePropagation()
    }

    document.addEventListener('pointerdown', blockOutsideInteraction, true)
    document.addEventListener('click', blockOutsideInteraction, true)
    document.addEventListener('input', blockOutsideInteraction, true)
    document.addEventListener('change', blockOutsideInteraction, true)
    document.addEventListener('submit', blockOutsideInteraction, true)
    document.addEventListener('keydown', blockOutsideKeyboard, true)
    return () => {
      document.removeEventListener('pointerdown', blockOutsideInteraction, true)
      document.removeEventListener('click', blockOutsideInteraction, true)
      document.removeEventListener('input', blockOutsideInteraction, true)
      document.removeEventListener('change', blockOutsideInteraction, true)
      document.removeEventListener('submit', blockOutsideInteraction, true)
      document.removeEventListener('keydown', blockOutsideKeyboard, true)
    }
  }, [tourOpen])

  const startTour = () => {
    if (!user) return
    setGuideOpen(false)
    setStepIndex(0)
    setTourOpen(true)
    router.push('/')
  }

  const openGuide = () => {
    setWelcomeOpen(false)
    setGuideOpen(true)
  }

  const helpButtonClass = 'group flex h-11 w-11 items-center justify-center rounded-full border border-[rgb(var(--line))] bg-[rgb(var(--surface))] text-lg font-black text-[rgb(var(--ink))] shadow-[3px_3px_0_rgb(var(--shadow)/0.08)] hover:border-[rgb(var(--gold))]'

  if (!mounted) return <button type="button" className={helpButtonClass} aria-label="Open app guide">?</button>

  const bubbleAbove = spotlight ? spotlight.top > window.innerHeight * (window.innerWidth < 768 ? 0.28 : 0.55) : false

  return (
    <>
      <button ref={helpButtonRef} type="button" className={helpButtonClass} aria-label="Open app guide" title="App guide" onClick={openGuide}>?</button>
      {welcomeOpen ? createPortal(
        <div className="real-tour-layer" aria-live="polite">
          {welcomeSpotlight ? <div className="real-tour-spotlight" style={{ top: welcomeSpotlight.top, left: welcomeSpotlight.left, width: welcomeSpotlight.width, height: welcomeSpotlight.height }} aria-hidden="true" /> : <div className="real-tour-dimmer" aria-hidden="true" />}
          <aside className="real-tour-bubble is-below" role="dialog" aria-label="Welcome to the score tracker">
            <div className="real-tour-heading"><span className="app-guide-avatar" aria-hidden="true">🀄</span><div><p className="app-guide-kicker">Ming says · Welcome!</p><h2>Welcome to Ken&apos;s Mahjong Club</h2></div><button type="button" onClick={() => setWelcomeOpen(false)} aria-label="Dismiss welcome">×</button></div>
            <p>I&apos;m Ming, your guide. Start with the highlighted <strong>?</strong> button to learn how the app works and take a guided tour of the real controls.</p>
            <strong>Tap the highlighted ? to start learning.</strong>
            <div className="real-tour-actions"><button type="button" onClick={() => setWelcomeOpen(false)}>Got it</button><button type="button" onClick={openGuide}>Open app guide</button></div>
          </aside>
        </div>, document.body
      ) : null}
      {guideOpen ? createPortal(
        <div className="app-guide-overlay" role="dialog" aria-modal="true" aria-labelledby="app-guide-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setGuideOpen(false) }}>
          <section className="app-guide-panel">
            <header><div><p className="app-guide-kicker">App guide</p><h2 id="app-guide-title">How the score tracker works</h2><p>Everything you need after signing in, in the order you will use it.</p></div><button type="button" onClick={() => setGuideOpen(false)} aria-label="Close app guide">×</button></header>
            <div className="app-guide-scroll">
              <div className="app-guide-intro"><span className="app-guide-avatar" aria-hidden="true">🀄</span><div><strong>Meet Ming, your guide</strong><p>Read the complete reference below, or let Ming point out the real controls in a no-write tour.</p></div></div>
              <ol className="app-guide-list">
                {GUIDE_SECTIONS.map((section, index) => (
                  <li key={section.title}>
                    <span aria-hidden="true">{section.icon}</span>
                    <div><small>{String(index + 1).padStart(2, '0')}</small><h3>{section.title}</h3><p>{section.body}</p>
                      {'fanMap' in section && section.fanMap ? <div className="app-guide-fan-map"><strong>Fan → Base Points</strong><table aria-label="Fan to base points"><thead><tr><th scope="col">Fan</th><th scope="col">Base points</th></tr></thead><tbody>{FAN_POINTS.map(([fan, points]) => <tr key={String(fan)}><td>{fan}</td><td>{points}</td></tr>)}</tbody></table></div> : null}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
            <footer><button type="button" onClick={() => setGuideOpen(false)}>Close</button><button type="button" onClick={startTour} disabled={!user} title={user ? 'Tour the real app' : 'Sign in to take the interactive tour'}>{user ? <>Take a Tour <span aria-hidden="true">→</span></> : 'Sign in to take tour'}</button></footer>
          </section>
        </div>, document.body
      ) : null}
      {tourOpen ? createPortal(
        <div className="real-tour-layer" aria-live="polite">
          {spotlight ? <div className="real-tour-spotlight" style={{ top: spotlight.top, left: spotlight.left, width: spotlight.width, height: spotlight.height }} aria-hidden="true" /> : <div className="real-tour-dimmer" aria-hidden="true" />}
          <aside ref={bubbleRef} className={`real-tour-bubble ${bubbleAbove ? 'is-above' : 'is-below'}`} role="status">
            <div className="real-tour-heading"><span className="app-guide-avatar" aria-hidden="true">🀄</span><div><p className="app-guide-kicker">Ming says · {stepIndex + 1}/{TOUR_STEPS.length}</p><h2>{step.title}</h2></div><button type="button" onClick={exitTour} aria-label="Exit tour">×</button></div>
            <p>{step.body}</p>
            {!spotlight ? <p className="real-tour-searching">Finding this part of the page…</p> : null}
            {step.instruction ? <strong>{step.instruction}</strong> : null}
            <div className="real-tour-actions">
              <button type="button" onClick={exitTour}>Exit tour</button>
              {stepIndex > 0 ? <button type="button" onClick={goBack}>Go back</button> : null}
              {step.action === 'finish' ? <button type="button" onClick={exitTour}>Finish</button> : targetRequiresClick ? <button type="button" onClick={advance} className="real-tour-skip">Skip this stop</button> : <button type="button" onClick={advance}>Next</button>}
            </div>
          </aside>
        </div>, document.body
      ) : null}
    </>
  )
}
