'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useFloatingSessionTracker } from '@/contexts/FloatingSessionTrackerContext'
import { useGameSync } from '@/contexts/GameSyncContext'
import {
  loadSessionPointTotals,
  type SessionPointWindowHours,
} from '@/lib/data'

const WINDOW_OPTIONS: { hours: SessionPointWindowHours; label: string }[] = [
  { hours: 24, label: '24h' },
  { hours: 48, label: '48h' },
  { hours: 168, label: '7d' },
]

function formatNet(points: number) {
  if (points > 0) return `+${points}`
  return String(points)
}

function windowTag(hours: number) {
  if (hours === 168) return '7d'
  return `${hours}h`
}

function clubPathMatches(pathname: string, clubId: string) {
  const prefix = `/club/${encodeURIComponent(clubId)}`
  return pathname === prefix || pathname.startsWith(`${prefix}/`)
}

export default function FloatingSessionTracker() {
  const pathname = usePathname() ?? ''
  const { user } = useAuth()
  const { state, disableFloat, setFloatHours } = useFloatingSessionTracker()
  const { pendingCount, attentionCount, online } = useGameSync()
  const [netPoints, setNetPoints] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const rootRef = useRef<HTMLElement>(null)

  const visible = Boolean(
    user &&
      state?.enabled &&
      state.clubId &&
      clubPathMatches(pathname, state.clubId),
  )

  const syncBannerVisible =
    !online || pendingCount > 0 || attentionCount > 0

  useEffect(() => {
    if (!visible || !state) {
      setNetPoints(null)
      setError(null)
      setMenuOpen(false)
      return
    }

    let cancelled = false
    const refresh = () => {
      void loadSessionPointTotals(state.clubId, state.hours)
        .then((result) => {
          if (cancelled) return
          const row = result.totals.find(
            (total) => total.playerId === state.playerId,
          )
          setNetPoints(row?.netPoints ?? 0)
          setError(null)
        })
        .catch((nextError) => {
          if (cancelled) return
          setError(
            nextError instanceof Error
              ? nextError.message
              : 'Unable to refresh session points.',
          )
        })
    }

    refresh()
    const timer = window.setInterval(refresh, 30_000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [state, visible])

  useEffect(() => {
    if (!menuOpen) return
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node | null
      if (rootRef.current && target && !rootRef.current.contains(target)) {
        setMenuOpen(false)
      }
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('touchstart', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('touchstart', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menuOpen])

  const netClass = useMemo(() => {
    if (netPoints == null) return 'floating-session-tracker-net-zero'
    if (netPoints > 0) return 'floating-session-tracker-net-up'
    if (netPoints < 0) return 'floating-session-tracker-net-down'
    return 'floating-session-tracker-net-zero'
  }, [netPoints])

  if (!visible || !state) return null

  return (
    <aside
      ref={rootRef}
      className={`floating-session-tracker${
        syncBannerVisible ? ' floating-session-tracker-above-sync' : ''
      }${menuOpen ? ' floating-session-tracker-menu-open' : ''}`}
      data-tour="floating-session-tracker"
      aria-label="Floating session tracker"
    >
      <button
        type="button"
        className="floating-session-tracker-body"
        data-tour="floating-session-tracker-toggle"
        aria-label="Change session window"
        aria-expanded={menuOpen}
        aria-controls="floating-session-window-menu"
        aria-haspopup="listbox"
        onClick={() => setMenuOpen((open) => !open)}
      >
        <span className="floating-session-tracker-icon" aria-hidden="true">
          {state.playerIcon}
        </span>
        <span className="floating-session-tracker-name">{state.playerName}</span>
        <span className={`floating-session-tracker-net ${netClass}`}>
          {error ? '—' : netPoints == null ? '…' : formatNet(netPoints)}
        </span>
        <span className="floating-session-tracker-window">
          {windowTag(state.hours)}
        </span>
      </button>
      <button
        type="button"
        className="floating-session-tracker-close"
        aria-label="Turn off floating session tracker"
        data-tour="floating-session-tracker-close"
        onClick={() => {
          setMenuOpen(false)
          disableFloat()
        }}
      >
        ×
      </button>
      {menuOpen ? (
        <div
          id="floating-session-window-menu"
          className="floating-session-tracker-menu"
          role="listbox"
          aria-label="Session window"
          data-tour="floating-session-window-menu"
        >
          {WINDOW_OPTIONS.map((option) => (
            <button
              key={option.hours}
              type="button"
              role="option"
              aria-selected={state.hours === option.hours}
              data-tour={`floating-session-window-${option.hours}`}
              className={`floating-session-tracker-menu-option${
                state.hours === option.hours
                  ? ' floating-session-tracker-menu-option-active'
                  : ''
              }`}
              onClick={() => {
                setFloatHours(option.hours)
                setMenuOpen(false)
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </aside>
  )
}
