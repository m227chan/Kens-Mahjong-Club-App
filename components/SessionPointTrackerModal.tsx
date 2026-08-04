'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  loadSessionPointBreakdown,
  loadSessionPointTotals,
  type SessionPointGameRow,
  type SessionPointTotal,
  type SessionPointWindowHours,
} from '@/lib/data'
import {
  buildCustomSessionWindow,
  hoursSessionWindow,
  sessionWindowPhrase,
  todayDateInputValue,
  type SessionPointWindow,
} from '@/lib/session-point-window'
import type { PlayerDoc } from '@/lib/types'
import { useFloatingSessionTracker } from '@/contexts/FloatingSessionTrackerContext'

const WINDOW_OPTIONS: { hours: SessionPointWindowHours; label: string }[] = [
  { hours: 24, label: '24 hours' },
  { hours: 48, label: '48 hours' },
  { hours: 168, label: '7 days' },
]

function formatNet(points: number) {
  if (points > 0) return `+${points}`
  return String(points)
}

function windowScopePhrase(window: SessionPointWindow) {
  if (window.mode === 'hours') {
    return `over the last ${sessionWindowPhrase(window)}`
  }
  if (window.startDate === window.endDate) {
    return `on ${window.startDate}`
  }
  return `from ${window.startDate} to ${window.endDate}`
}

function formatPlayedAt(iso: string) {
  const date = new Date(iso)
  if (!Number.isFinite(date.getTime())) return iso
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

function winTypeLabel(winType: string | null) {
  if (winType === 'self_draw') return 'Self-draw'
  if (winType === 'discard') return 'Discard'
  if (winType === 'draw') return 'Draw'
  return winType ?? '—'
}

export default function SessionPointTrackerModal({
  clubId,
  clubName,
  players,
  linkedPlayerId,
  onClose,
}: {
  clubId: string
  clubName: string
  players: PlayerDoc[]
  linkedPlayerId: string | null
  onClose: () => void
}) {
  const today = todayDateInputValue()
  const [window, setWindow] = useState<SessionPointWindow>(() =>
    hoursSessionWindow(24),
  )
  const [customStartDate, setCustomStartDate] = useState(today)
  const [customEndDate, setCustomEndDate] = useState(today)
  const [customError, setCustomError] = useState<string | null>(null)
  const [selectedPlayerId, setSelectedPlayerId] = useState(
    linkedPlayerId ?? players[0]?.id ?? '',
  )
  const [totals, setTotals] = useState<SessionPointTotal[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showBreakdown, setShowBreakdown] = useState(false)
  const [breakdown, setBreakdown] = useState<SessionPointGameRow[]>([])
  const [breakdownLoading, setBreakdownLoading] = useState(false)
  const [breakdownError, setBreakdownError] = useState<string | null>(null)
  const { enableFloat, isFloatingFor } = useFloatingSessionTracker()
  const floatingActive =
    Boolean(selectedPlayerId) && isFloatingFor(clubId, selectedPlayerId, window)
  const customSelected = window.mode === 'range'

  useEffect(() => {
    // Only fill a missing/invalid selection — never override a manual player pick.
    if (selectedPlayerId && players.some((player) => player.id === selectedPlayerId))
      return
    setSelectedPlayerId(linkedPlayerId ?? players[0]?.id ?? '')
  }, [linkedPlayerId, players, selectedPlayerId])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    void loadSessionPointTotals(clubId, window)
      .then((result) => {
        if (cancelled) return
        setTotals(result.totals)
      })
      .catch((nextError) => {
        if (cancelled) return
        setError(
          nextError instanceof Error
            ? nextError.message
            : 'Unable to load session points.',
        )
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clubId, window])

  useEffect(() => {
    if (!showBreakdown || !selectedPlayerId) return
    let cancelled = false
    setBreakdownLoading(true)
    setBreakdownError(null)
    void loadSessionPointBreakdown(clubId, selectedPlayerId, window)
      .then((result) => {
        if (cancelled) return
        setBreakdown(result.games)
      })
      .catch((nextError) => {
        if (cancelled) return
        setBreakdownError(
          nextError instanceof Error
            ? nextError.message
            : 'Unable to load game breakdown.',
        )
      })
      .finally(() => {
        if (!cancelled) setBreakdownLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [clubId, window, selectedPlayerId, showBreakdown])

  const selectedTotal = useMemo(
    () => totals.find((total) => total.playerId === selectedPlayerId) ?? null,
    [selectedPlayerId, totals],
  )

  const selectedPlayer =
    players.find((player) => player.id === selectedPlayerId) ??
    (selectedTotal
      ? {
          id: selectedTotal.playerId,
          displayName: selectedTotal.displayName,
          icon: selectedTotal.icon,
        }
      : null)

  const applyCustomRange = (startDate: string, endDate: string) => {
    try {
      const next = buildCustomSessionWindow(startDate, endDate)
      setCustomError(null)
      setCustomStartDate(next.startDate)
      setCustomEndDate(next.endDate)
      setWindow(next)
    } catch (nextError) {
      setCustomError(
        nextError instanceof Error
          ? nextError.message
          : 'Choose a valid date range.',
      )
    }
  }

  return (
    <div
      className="responsive-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div
        id="club-session-tracker-dialog"
        data-tour="session-tracker-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="club-session-tracker-title"
        className={`responsive-modal-panel flex max-h-[calc(100dvh-3rem)] min-h-0 w-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl ${
          showBreakdown ? 'max-w-3xl' : 'max-w-lg'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Session tracker
            </p>
            <h3
              id="club-session-tracker-title"
              className="mt-2 text-xl font-black text-slate-950"
            >
              Net change this session
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              Points gained or lost in {clubName} {windowScopePhrase(window)} —
              not your overall standing.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              data-tour="session-tracker-float"
              disabled={!selectedPlayerId || !selectedPlayer}
              onClick={() => {
                if (!selectedPlayerId || !selectedPlayer) return
                enableFloat({
                  clubId,
                  clubName,
                  playerId: selectedPlayer.id,
                  playerName: selectedPlayer.displayName,
                  playerIcon: selectedPlayer.icon,
                  window,
                })
              }}
              className={`min-h-11 rounded-lg border px-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                floatingActive
                  ? 'border-[rgb(var(--bamboo))] bg-[rgb(var(--bamboo)/.12)] text-[rgb(var(--bamboo))]'
                  : 'border-slate-300 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {floatingActive ? 'Floating' : 'Float'}
            </button>
            <button
              data-tour="session-tracker-close"
              type="button"
              onClick={onClose}
              className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600"
            >
              Close
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <div
            className="grid grid-cols-2 gap-2 sm:grid-cols-4"
            role="group"
            aria-label="Time window"
          >
            {WINDOW_OPTIONS.map((option) => (
              <button
                key={option.hours}
                type="button"
                aria-pressed={
                  window.mode === 'hours' && window.hours === option.hours
                }
                data-tour={`session-window-${option.hours}`}
                onClick={() => {
                  setCustomError(null)
                  setWindow(hoursSessionWindow(option.hours))
                }}
                className={`min-h-11 rounded-lg border px-2 text-sm font-black transition ${
                  window.mode === 'hours' && window.hours === option.hours
                    ? 'border-[rgb(var(--bamboo))] bg-[rgb(var(--bamboo))] text-white'
                    : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                {option.label}
              </button>
            ))}
            <button
              type="button"
              aria-pressed={customSelected}
              data-tour="session-window-custom"
              onClick={() => applyCustomRange(customStartDate, customEndDate)}
              className={`min-h-11 rounded-lg border px-2 text-sm font-black transition ${
                customSelected
                  ? 'border-[rgb(var(--bamboo))] bg-[rgb(var(--bamboo))] text-white'
                  : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              Custom
            </button>
          </div>

          {customSelected ? (
            <div
              className="grid gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2"
              data-tour="session-window-custom-fields"
            >
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  From
                </span>
                <input
                  type="date"
                  data-tour="session-window-start"
                  value={customStartDate}
                  max={customEndDate || today}
                  onChange={(event) => {
                    const nextStart = event.target.value
                    setCustomStartDate(nextStart)
                    applyCustomRange(nextStart, customEndDate)
                  }}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900"
                />
              </label>
              <label className="block space-y-1">
                <span className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                  To
                </span>
                <input
                  type="date"
                  data-tour="session-window-end"
                  value={customEndDate}
                  min={customStartDate || undefined}
                  max={today}
                  onChange={(event) => {
                    const nextEnd = event.target.value
                    setCustomEndDate(nextEnd)
                    applyCustomRange(customStartDate, nextEnd)
                  }}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900"
                />
              </label>
              {customError ? (
                <p
                  role="alert"
                  className="sm:col-span-2 text-sm font-bold text-rose-700"
                >
                  {customError}
                </p>
              ) : null}
            </div>
          ) : null}

          {players.length === 0 ? (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              Add players to the roster before tracking session points.
            </p>
          ) : (
            <label className="block space-y-2">
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
                Player
              </span>
              <select
                data-tour="session-tracker-player"
                value={selectedPlayerId}
                onChange={(event) => {
                  setSelectedPlayerId(event.target.value)
                  setShowBreakdown(false)
                }}
                className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900"
              >
                {!linkedPlayerId ? (
                  <option value="" disabled>
                    Select a player to track
                  </option>
                ) : null}
                {players.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.icon} {player.displayName}
                    {player.id === linkedPlayerId ? ' (you)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}

          {error ? (
            <p
              role="alert"
              className="rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm font-bold text-rose-800"
            >
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="rounded-lg border border-slate-200 bg-slate-50 p-6 text-center text-sm font-bold text-slate-600">
              Loading session points…
            </p>
          ) : selectedPlayerId && selectedPlayer ? (
            <section
              className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-center"
              aria-live="polite"
            >
              <p className="text-3xl" aria-hidden="true">
                {selectedPlayer.icon}
              </p>
              <h4 className="mt-2 text-lg font-black text-slate-950">
                {selectedPlayer.displayName}
              </h4>
              <p
                className={`mt-3 text-4xl font-black ${
                  (selectedTotal?.netPoints ?? 0) > 0
                    ? 'text-[rgb(var(--bamboo))]'
                    : (selectedTotal?.netPoints ?? 0) < 0
                      ? 'text-[rgb(var(--cinnabar))]'
                      : 'text-slate-700'
                }`}
                data-tour="session-tracker-net"
              >
                {formatNet(selectedTotal?.netPoints ?? 0)}
              </p>
              <p className="mt-2 text-sm font-semibold text-slate-500">
                net change · {selectedTotal?.games ?? 0} game
                {(selectedTotal?.games ?? 0) === 1 ? '' : 's'}{' '}
                {windowScopePhrase(window)}
              </p>
              <button
                type="button"
                data-tour="session-tracker-view-more"
                onClick={() => setShowBreakdown((open) => !open)}
                className="mt-4 min-h-10 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100"
              >
                {showBreakdown ? 'Hide breakdown' : 'View more'}
              </button>
            </section>
          ) : (
            <p className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-4 text-sm font-semibold text-slate-600">
              Choose a player to see their running total.
            </p>
          )}

          {showBreakdown ? (
            <section
              className="rounded-xl border border-slate-200 bg-white"
              aria-label="Game breakdown"
            >
              <div className="border-b border-slate-200 px-4 py-3">
                <h4 className="text-sm font-black uppercase tracking-[0.14em] text-slate-600">
                  Game summary
                </h4>
                <p className="mt-1 text-sm text-slate-500">
                  Each hand&apos;s point change for {selectedPlayer?.displayName}{' '}
                  {windowScopePhrase(window)}.
                </p>
              </div>
              {breakdownError ? (
                <p
                  role="alert"
                  className="m-4 rounded-lg border border-rose-300 bg-rose-50 p-3 text-sm font-bold text-rose-800"
                >
                  {breakdownError}
                </p>
              ) : null}
              {breakdownLoading ? (
                <p className="p-6 text-center text-sm font-bold text-slate-600">
                  Loading games…
                </p>
              ) : breakdown.length === 0 ? (
                <p className="p-6 text-center text-sm font-semibold text-slate-500">
                  No games in this window.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
                      <tr>
                        <th className="px-4 py-3">When</th>
                        <th className="px-4 py-3">Result</th>
                        <th className="px-4 py-3">Table</th>
                        <th className="px-4 py-3">Fan</th>
                        <th className="px-4 py-3">Opponents</th>
                        <th className="px-4 py-3 text-right">Change</th>
                      </tr>
                    </thead>
                    <tbody>
                      {breakdown.map((game) => (
                        <tr
                          key={game.gameId}
                          className="border-t border-slate-100"
                          data-tour="session-breakdown-row"
                        >
                          <td className="whitespace-nowrap px-4 py-3 font-semibold text-slate-700">
                            {formatPlayedAt(game.playedAt)}
                          </td>
                          <td className="px-4 py-3 font-semibold text-slate-700">
                            {winTypeLabel(game.winType)}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {game.tableId ? `T${game.tableId}` : '—'}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {game.fan == null ? '—' : game.fan}
                          </td>
                          <td className="max-w-[12rem] truncate px-4 py-3 text-slate-600">
                            {game.opponents || '—'}
                          </td>
                          <td
                            className={`whitespace-nowrap px-4 py-3 text-right font-black ${
                              game.score > 0
                                ? 'text-[rgb(var(--bamboo))]'
                                : game.score < 0
                                  ? 'text-[rgb(var(--cinnabar))]'
                                  : 'text-slate-600'
                            }`}
                          >
                            {formatNet(game.score)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  )
}
