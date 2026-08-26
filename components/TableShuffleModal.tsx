'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  loadAllGames,
  loadPlayerStats,
  loadSessionPointTotals,
} from '@/lib/data'
import { hoursSessionWindow } from '@/lib/session-point-window'
import {
  DEFAULT_SHUFFLE_MODE,
  DEFAULT_SKILL_RATING,
  SHUFFLE_MODE_META,
  analyzeEligibleTables,
  buildAbsNetByPair,
  buildCoPlayByPair,
  shuffleTables,
  type ShuffleMode,
  type ShuffleResult,
} from '@/lib/table-shuffle'
import type { PlayerDoc } from '@/lib/types'

function shortName(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length <= 1) return name
  return parts[0]!
}

type SeatRef = { tableId: string; seatIndex: number; playerId: string }

function findSeat(
  tables: Record<string, string[]>,
  tableIds: string[],
  playerId: string,
): SeatRef | null {
  for (const tableId of tableIds) {
    const seats = tables[tableId] ?? []
    const seatIndex = seats.indexOf(playerId)
    if (seatIndex >= 0) {
      return { tableId, seatIndex, playerId }
    }
  }
  return null
}

function swapPreviewPlayers(
  tables: Record<string, string[]>,
  tableIds: string[],
  firstPlayerId: string,
  secondPlayerId: string,
): Record<string, string[]> {
  if (firstPlayerId === secondPlayerId) return tables
  const first = findSeat(tables, tableIds, firstPlayerId)
  const second = findSeat(tables, tableIds, secondPlayerId)
  if (!first || !second) return tables

  const next: Record<string, string[]> = { ...tables }
  const firstSeats = [...(next[first.tableId] ?? [])]
  const secondSeats =
    first.tableId === second.tableId
      ? firstSeats
      : [...(next[second.tableId] ?? [])]

  firstSeats[first.seatIndex] = second.playerId
  secondSeats[second.seatIndex] = first.playerId
  next[first.tableId] = firstSeats
  if (first.tableId !== second.tableId) next[second.tableId] = secondSeats
  return next
}

export default function TableShuffleModal({
  clubId,
  seasonNumber,
  tables,
  players,
  onConfirm,
  onClose,
}: {
  clubId: string
  seasonNumber: number
  tables: Record<string, string[]>
  players: PlayerDoc[]
  onConfirm: (nextTables: Record<string, string[]>) => void
  onClose: () => void
}) {
  const [mode, setMode] = useState<ShuffleMode>(DEFAULT_SHUFFLE_MODE)
  const [preview, setPreview] = useState<ShuffleResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null)
  const [beforeCollapsed, setBeforeCollapsed] = useState(false)
  const [afterCollapsed, setAfterCollapsed] = useState(false)

  const eligible = useMemo(() => analyzeEligibleTables(tables), [tables])
  const modeMeta = SHUFFLE_MODE_META.find((entry) => entry.id === mode)
  const playerById = useMemo(() => {
    const map = new Map(players.map((player) => [player.id, player]))
    return map
  }, [players])

  const isCompactPreview = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(max-width: 639px)').matches

  const resetPreviewChrome = () => {
    setSwapSourceId(null)
    setBeforeCollapsed(false)
    setAfterCollapsed(false)
  }

  useEffect(() => {
    if (!swapSourceId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setSwapSourceId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [swapSourceId])

  const playerLabel = (playerId: string) => {
    const player = playerById.get(playerId)
    return {
      icon: player?.icon ?? '👤',
      name: shortName(player?.displayName ?? playerId),
      fullName: player?.displayName ?? playerId,
    }
  }

  const canPreview = eligible.touchedTableIds.length >= 1 && !loading

  const runPreview = async () => {
    if (!canPreview) return
    setLoading(true)
    setError(null)
    setPreview(null)
    resetPreviewChrome()
    try {
      const needsSession = mode === 'sharkRedemption'
      const needsGames = mode === 'nemesis' || mode === 'neverMet'
      const needsStats = mode === 'skillBalance' || mode === 'standingsBalance'

      const [sessionPayload, games, stats] = await Promise.all([
        needsSession
          ? loadSessionPointTotals(clubId, hoursSessionWindow(24))
          : Promise.resolve(null),
        needsGames ? loadAllGames(clubId) : Promise.resolve([] as Awaited<ReturnType<typeof loadAllGames>>),
        needsStats
          ? loadPlayerStats(clubId, seasonNumber)
          : Promise.resolve([] as Awaited<ReturnType<typeof loadPlayerStats>>),
      ])

      const sessionNetByPlayer = Object.fromEntries(
        (sessionPayload?.totals ?? []).map((row) => [row.playerId, row.netPoints]),
      )
      const skillByPlayer = Object.fromEntries(
        stats.map((row) => [row.playerId, row.skillRating ?? DEFAULT_SKILL_RATING]),
      )
      const pointsByPlayer = Object.fromEntries(
        stats.map((row) => [row.playerId, row.totalPoints ?? 0]),
      )
      const absNetByPair = needsGames
        ? buildAbsNetByPair(games, eligible.pool)
        : {}
      const coPlayByPair = needsGames
        ? buildCoPlayByPair(games, eligible.pool)
        : {}

      const result = shuffleTables({
        tables,
        mode,
        metrics: {
          sessionNetByPlayer,
          skillByPlayer,
          pointsByPlayer,
          absNetByPair,
          coPlayByPair,
        },
      })
      setPreview(result)
      if (isCompactPreview()) {
        setBeforeCollapsed(true)
        setAfterCollapsed(false)
      }
    } catch (previewError) {
      setError(
        previewError instanceof Error
          ? previewError.message
          : 'Unable to preview that shuffle.',
      )
    } finally {
      setLoading(false)
    }
  }

  const applyConfirm = () => {
    if (!preview || confirming) return
    setConfirming(true)
    onConfirm(preview.tables)
  }

  const handleAfterSeatClick = (playerId: string) => {
    if (!preview) return
    if (!swapSourceId) {
      setSwapSourceId(playerId)
      return
    }
    if (swapSourceId === playerId) {
      setSwapSourceId(null)
      return
    }
    const nextTables = swapPreviewPlayers(
      preview.tables,
      preview.touchedTableIds,
      swapSourceId,
      playerId,
    )
    setPreview({ ...preview, tables: nextTables })
    setSwapSourceId(null)
  }

  const renderTableSeats = (
    tableId: string,
    seats: string[],
    tone: 'before' | 'after',
  ) => (
    <div
      key={`${tone}-${tableId}`}
      className={`rounded-lg border p-3 ${
        tone === 'after'
          ? 'border-[rgb(var(--bamboo)/.45)] bg-[rgb(var(--bamboo)/.06)]'
          : 'border-slate-200 bg-slate-50'
      }`}
    >
      <div className="mb-2 text-xs font-black uppercase tracking-wide text-slate-500">
        Table {tableId}
      </div>
      <ul className="grid grid-cols-2 gap-2">
        {seats.map((playerId) => {
          const info = playerLabel(playerId)
          if (tone === 'before') {
            return (
              <li
                key={`${tone}-${tableId}-${playerId}`}
                className="flex min-h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-2 text-sm font-semibold text-slate-800"
                title={info.fullName}
              >
                <span aria-hidden="true">{info.icon}</span>
                <span className="truncate">{info.name}</span>
              </li>
            )
          }

          const selected = swapSourceId === playerId
          const swapTarget = Boolean(swapSourceId) && !selected
          return (
            <li key={`${tone}-${tableId}-${playerId}`}>
              <button
                type="button"
                onClick={() => handleAfterSeatClick(playerId)}
                aria-pressed={selected}
                aria-label={
                  selected
                    ? `${info.fullName} selected for swap. Click another player to swap, or click again to cancel.`
                    : swapTarget
                      ? `Swap with ${info.fullName}`
                      : `Select ${info.fullName} to swap`
                }
                title={info.fullName}
                className={`flex min-h-10 w-full items-center gap-2 rounded-md border px-2 text-left text-sm font-semibold transition ${
                  selected
                    ? 'border-[rgb(var(--bamboo))] bg-[rgb(var(--bamboo)/.18)] text-slate-950 ring-2 ring-[rgb(var(--bamboo)/.35)]'
                    : swapTarget
                      ? 'border-slate-300 bg-white text-slate-800 hover:border-[rgb(var(--bamboo))] hover:bg-[rgb(var(--bamboo)/.08)]'
                      : 'border-slate-200 bg-white text-slate-800 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span aria-hidden="true">{info.icon}</span>
                <span className="truncate">{info.name}</span>
                {selected ? (
                  <span className="ml-auto text-[10px] font-black uppercase tracking-wide text-[rgb(var(--bamboo))]">
                    Swap
                  </span>
                ) : null}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )

  return (
    <div
      className="responsive-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !loading && !confirming) onClose()
      }}
    >
      <div
        id="table-shuffle-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="table-shuffle-title"
        className="responsive-modal-panel flex max-h-[calc(100dvh-3rem)] min-h-0 w-full max-w-2xl flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
              Session tables
            </p>
            <h3
              id="table-shuffle-title"
              className="mt-2 text-xl font-black text-slate-950"
            >
              Shuffle tables
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              {eligible.touchedTableIds.length} full table
              {eligible.touchedTableIds.length === 1 ? '' : 's'} will be
              reshuffled
              {eligible.skippedTableIds.length > 0
                ? `; ${eligible.skippedTableIds.length} partial table${
                    eligible.skippedTableIds.length === 1 ? '' : 's'
                  } skipped`
                : ''}
              . Sideline players stay put.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={loading || confirming}
            className="min-h-11 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600 disabled:opacity-40"
          >
            Cancel
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-5">
          <label className="block space-y-2">
            <span className="text-sm font-bold text-slate-700">Shuffle mode</span>
            <select
              value={mode}
              onChange={(event) => {
                setMode(event.target.value as ShuffleMode)
                setPreview(null)
                resetPreviewChrome()
                setError(null)
              }}
              className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-800"
            >
              {SHUFFLE_MODE_META.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
            {modeMeta ? (
              <p className="text-sm text-slate-500">{modeMeta.description}</p>
            ) : null}
          </label>

          {eligible.touchedTableIds.length === 0 ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
              Seat at least one full table of 4 players before shuffling.
            </p>
          ) : null}

          {error ? (
            <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-800">
              {error}
            </p>
          ) : null}

          {preview ? (
            <div className="space-y-3">
              <div className="flex flex-wrap items-end justify-between gap-2">
                <h4 className="text-sm font-black uppercase tracking-wide text-slate-600">
                  Preview
                </h4>
                <p className="text-xs font-semibold text-slate-500" aria-live="polite">
                  {swapSourceId
                    ? 'Tap another player in After to swap, or Esc to cancel.'
                    : 'Tap two players in After to swap seats.'}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 sm:hidden">
                <button
                  type="button"
                  onClick={() => setBeforeCollapsed((value) => !value)}
                  aria-expanded={!beforeCollapsed}
                  className="min-h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700"
                >
                  {beforeCollapsed ? 'Show Before' : 'Hide Before'}
                </button>
                <button
                  type="button"
                  onClick={() => setAfterCollapsed((value) => !value)}
                  aria-expanded={!afterCollapsed}
                  className="min-h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-xs font-bold text-slate-700"
                >
                  {afterCollapsed ? 'Show After' : 'Hide After'}
                </button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <section className="space-y-2" aria-labelledby="shuffle-before-heading">
                  <button
                    type="button"
                    id="shuffle-before-heading"
                    onClick={() => setBeforeCollapsed((value) => !value)}
                    aria-expanded={!beforeCollapsed}
                    className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 sm:pointer-events-none sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0"
                  >
                    <span>Before</span>
                    <span className="normal-case tracking-normal text-slate-400 sm:hidden" aria-hidden="true">
                      {beforeCollapsed ? '▸' : '▾'}
                    </span>
                  </button>
                  <div className={beforeCollapsed ? 'hidden space-y-2 sm:block' : 'space-y-2'}>
                    {preview.touchedTableIds.map((tableId) =>
                      renderTableSeats(tableId, tables[tableId] ?? [], 'before'),
                    )}
                  </div>
                  {beforeCollapsed ? (
                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 sm:hidden">
                      Before seating hidden — tap Show Before to compare.
                    </p>
                  ) : null}
                </section>
                <section className="space-y-2" aria-labelledby="shuffle-after-heading">
                  <button
                    type="button"
                    id="shuffle-after-heading"
                    onClick={() => setAfterCollapsed((value) => !value)}
                    aria-expanded={!afterCollapsed}
                    className="flex min-h-10 w-full items-center justify-between gap-2 rounded-lg border border-[rgb(var(--bamboo)/.35)] bg-[rgb(var(--bamboo)/.06)] px-3 text-left text-xs font-bold uppercase tracking-wide text-slate-500 sm:pointer-events-none sm:min-h-0 sm:border-0 sm:bg-transparent sm:px-0"
                  >
                    <span>After</span>
                    <span className="normal-case tracking-normal text-slate-400 sm:hidden" aria-hidden="true">
                      {afterCollapsed ? '▸' : '▾'}
                    </span>
                  </button>
                  <div className={afterCollapsed ? 'hidden space-y-2 sm:block' : 'space-y-2'}>
                    {preview.touchedTableIds.map((tableId) =>
                      renderTableSeats(
                        tableId,
                        preview.tables[tableId] ?? [],
                        'after',
                      ),
                    )}
                  </div>
                  {afterCollapsed ? (
                    <p className="rounded-lg border border-dashed border-slate-200 px-3 py-2 text-xs font-semibold text-slate-500 sm:hidden">
                      After seating hidden — tap Show After to swap or review.
                    </p>
                  ) : null}
                </section>
              </div>
            </div>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-200 bg-slate-50 p-4">
          <button
            type="button"
            onClick={() => void runPreview()}
            disabled={!canPreview}
            className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {loading ? 'Generating…' : preview ? 'Regenerate preview' : 'Preview'}
          </button>
          <button
            type="button"
            onClick={applyConfirm}
            disabled={!preview || confirming || loading}
            className="min-h-11 rounded-lg bg-[rgb(var(--bamboo))] px-4 text-sm font-bold text-white hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {confirming ? 'Applying…' : 'Confirm shuffle'}
          </button>
        </div>
      </div>
    </div>
  )
}
