'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { NetworkGraph } from '@/components/network/NetworkGraph'
import { computeNetworkEdges, filterEdges } from '@/components/network/computeNetworkEdges'
import type { NetworkGraphData } from '@/components/network/types'
import { computeNetPointsWithEgo } from '@/components/network/pointsGiven'
import { loadAllGames } from '@/lib/data'
import type { GameDoc, PlayerDoc, SeasonDoc } from '@/lib/types'

type NetworkViewMode = 'graph' | 'table'

function toDateInputValue(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function startOfLocalDay(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 0, 0, 0, 0).getTime()
}

function endOfLocalDay(value: string) {
  const [year, month, day] = value.split('-').map(Number)
  return new Date(year, month - 1, day, 23, 59, 59, 999).getTime()
}

function seasonGames(games: GameDoc[], seasonFilter: number | 'all') {
  return seasonFilter === 'all'
    ? games
    : games.filter((game) => (game.seasonNumber ?? 1) === seasonFilter)
}

function dateBoundsForGames(games: GameDoc[]): { from: string; to: string } | null {
  if (games.length === 0) return null
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY
  for (const game of games) {
    const millis = game.datetime?.toMillis?.() ?? 0
    if (!millis) continue
    if (millis < min) min = millis
    if (millis > max) max = millis
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null
  return { from: toDateInputValue(new Date(min)), to: toDateInputValue(new Date(max)) }
}

function formatNet(value: number) {
  const rounded = Math.round(value)
  if (rounded > 0) return `+${rounded}`
  return String(rounded)
}

export default function NetworkGraphModal({
  clubId,
  players,
  seasons,
  currentSeason,
  onClose,
}: {
  clubId: string
  players: PlayerDoc[]
  seasons: SeasonDoc[]
  currentSeason: number
  onClose: () => void
}) {
  const [games, setGames] = useState<GameDoc[]>([])
  const [loading, setLoading] = useState(true)
  const [seasonFilter, setSeasonFilter] = useState<number | 'all'>(currentSeason)
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [egoPlayerId, setEgoPlayerId] = useState('')
  const [minGames, setMinGames] = useState(1)
  const [viewMode, setViewMode] = useState<NetworkViewMode>('graph')
  const [tableSort, setTableSort] = useState<'playerA' | 'playerB' | 'opponent' | 'gamesTogether' | 'net'>('gamesTogether')
  const [tableSortDirection, setTableSortDirection] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadAllGames(clubId)
      .then((loaded) => {
        if (!cancelled) setGames(loaded)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [clubId])

  useEffect(() => {
    setSeasonFilter(currentSeason)
  }, [currentSeason])

  // Keep sort column valid when switching between all-players and ego table layouts.
  useEffect(() => {
    if (egoPlayerId && (tableSort === 'playerA' || tableSort === 'playerB')) {
      setTableSort('gamesTogether')
      setTableSortDirection('desc')
    } else if (!egoPlayerId && (tableSort === 'opponent' || tableSort === 'net')) {
      setTableSort('gamesTogether')
      setTableSortDirection('desc')
    }
  }, [egoPlayerId, tableSort])

  // Default date range to the full selected season (or all games).
  useEffect(() => {
    const bounds = dateBoundsForGames(seasonGames(games, seasonFilter))
    if (!bounds) {
      setDateFrom('')
      setDateTo('')
      return
    }
    setDateFrom(bounds.from)
    setDateTo(bounds.to)
  }, [games, seasonFilter])

  const seasonScopedGames = useMemo(
    () => seasonGames(games, seasonFilter),
    [games, seasonFilter]
  )

  const filteredGames = useMemo(() => {
    return seasonScopedGames.filter((game) => {
      const millis = game.datetime?.toMillis?.() ?? 0
      if (dateFrom && millis < startOfLocalDay(dateFrom)) return false
      if (dateTo && millis > endOfLocalDay(dateTo)) return false
      return true
    })
  }, [seasonScopedGames, dateFrom, dateTo])

  const seasonBounds = useMemo(() => dateBoundsForGames(seasonScopedGames), [seasonScopedGames])

  const labels = useMemo(
    () => Object.fromEntries(players.map((player) => [player.id, player.displayName])),
    [players]
  )

  const networkData: NetworkGraphData = useMemo(() => ({
    entities: players.map((player) => player.id),
    events: filteredGames.map((game) => ({
      id: game.id,
      participants: game.entries.map((entry) => entry.playerId),
      timestamp: game.datetime?.toDate?.()?.toISOString?.(),
    })),
  }), [filteredGames, players])

  const netPointsWithEgo = useMemo(() => {
    if (!egoPlayerId) return null
    return computeNetPointsWithEgo(filteredGames, egoPlayerId)
  }, [filteredGames, egoPlayerId])

  const tableRows = useMemo(() => {
    const edges = filterEdges(computeNetworkEdges(networkData), {
      minWeight: minGames,
      egoEntity: egoPlayerId || null,
    })

    const rows = edges.map((edge) => {
      const opponentId = egoPlayerId
        ? (edge.from === egoPlayerId ? edge.to : edge.from)
        : null
      const playerA = labels[edge.from] ?? edge.from
      const playerB = labels[edge.to] ?? edge.to
      const net = opponentId && netPointsWithEgo ? netPointsWithEgo[opponentId] ?? 0 : null
      return {
        key: `${edge.from}::${edge.to}`,
        fromId: edge.from,
        toId: edge.to,
        playerA,
        playerB,
        opponentId,
        opponentName: opponentId ? (labels[opponentId] ?? opponentId) : null,
        gamesTogether: edge.weight,
        net,
      }
    })

    const direction = tableSortDirection === 'asc' ? 1 : -1
    rows.sort((left, right) => {
      let compare = 0
      if (tableSort === 'gamesTogether') {
        compare = left.gamesTogether - right.gamesTogether
      } else if (tableSort === 'net') {
        compare = (left.net ?? 0) - (right.net ?? 0)
      } else if (tableSort === 'opponent') {
        compare = (left.opponentName ?? '').localeCompare(right.opponentName ?? '')
      } else if (tableSort === 'playerA') {
        compare = left.playerA.localeCompare(right.playerA)
      } else if (tableSort === 'playerB') {
        compare = left.playerB.localeCompare(right.playerB)
      }
      if (compare !== 0) return compare * direction
      return right.gamesTogether - left.gamesTogether
        || left.playerA.localeCompare(right.playerA)
        || left.playerB.localeCompare(right.playerB)
    })

    return rows
  }, [networkData, minGames, egoPlayerId, labels, netPointsWithEgo, tableSort, tableSortDirection])

  const sortedPlayers = useMemo(
    () => [...players].sort((a, b) => a.displayName.localeCompare(b.displayName)),
    [players]
  )

  const handleNodeClick = useCallback((entityId: string) => {
    setEgoPlayerId(entityId)
  }, [])

  const toggleTableSort = (column: typeof tableSort) => {
    if (tableSort === column) {
      setTableSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'))
      return
    }
    setTableSort(column)
    setTableSortDirection(column === 'playerA' || column === 'playerB' || column === 'opponent' ? 'asc' : 'desc')
  }

  const sortMark = (column: typeof tableSort) => (
    tableSort === column ? (tableSortDirection === 'asc' ? '▲' : '▼') : '↕'
  )

  const resetDateRange = () => {
    if (!seasonBounds) return
    setDateFrom(seasonBounds.from)
    setDateTo(seasonBounds.to)
  }

  const egoName = egoPlayerId ? labels[egoPlayerId] ?? 'Selected player' : null

  return (
    <div className="responsive-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <div data-tour="network-modal" className="responsive-modal-panel flex max-h-[92vh] w-full max-w-6xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">Player Network</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">Who plays with whom</h3>
            <p className="mt-1 text-sm text-slate-500">
              Edges connect players who shared a table. Thickness shows how many games they played together.
              {egoPlayerId ? ' Node color is net points vs the selected player (green/cream = they paid selected more, red = selected paid them more).' : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div
              role="group"
              aria-label="Network view mode"
              className="inline-flex rounded-lg border border-slate-300 bg-slate-100 p-1"
            >
              <button
                type="button"
                aria-pressed={viewMode === 'graph'}
                onClick={() => setViewMode('graph')}
                className={`rounded-md px-3 py-1.5 text-sm font-bold transition ${
                  viewMode === 'graph'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Graph
              </button>
              <button
                type="button"
                aria-pressed={viewMode === 'table'}
                onClick={() => setViewMode('table')}
                className={`rounded-md px-3 py-1.5 text-sm font-bold transition ${
                  viewMode === 'table'
                    ? 'bg-white text-slate-950 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                Table
              </button>
            </div>
            <button
              data-tour="network-close"
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600"
            >
              Close
            </button>
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Season
              <select
                value={seasonFilter === 'all' ? 'all' : String(seasonFilter)}
                onChange={(event) => {
                  const value = event.target.value
                  setSeasonFilter(value === 'all' ? 'all' : Number(value))
                }}
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
              >
                <option value="all">All seasons</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.seasonNumber}>
                    {season.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              From
              <input
                type="date"
                value={dateFrom}
                min={seasonBounds?.from}
                max={dateTo || seasonBounds?.to}
                onChange={(event) => setDateFrom(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
              />
            </label>

            <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              To
              <div className="mt-2 flex gap-2">
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || seasonBounds?.from}
                  max={seasonBounds?.to}
                  onChange={(event) => setDateTo(event.target.value)}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
                />
                <button
                  type="button"
                  onClick={resetDateRange}
                  disabled={!seasonBounds}
                  title="Reset to full season"
                  className="shrink-0 rounded-lg border border-slate-300 px-3 text-xs font-bold text-slate-600 hover:bg-white disabled:opacity-40"
                >
                  Full
                </button>
              </div>
            </label>

            <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Ego player (optional)
              <select
                value={egoPlayerId}
                onChange={(event) => setEgoPlayerId(event.target.value)}
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
              >
                <option value="">All players</option>
                {sortedPlayers.map((player) => (
                  <option key={player.id} value={player.id}>
                    {player.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Min games together
              <input
                type="number"
                min={1}
                value={minGames}
                onChange={(event) => setMinGames(Math.max(1, Number(event.target.value) || 1))}
                className="mt-2 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-900"
              />
            </label>
          </div>

          {egoPlayerId && viewMode === 'graph' ? (
            <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
                Net vs {egoName}
              </p>
              <div className="flex min-w-[220px] flex-1 items-center gap-2">
                <span className="text-[11px] font-semibold text-slate-500">Selected paid them</span>
                <div
                  className="h-3 flex-1 rounded-full border border-slate-200 bg-[linear-gradient(90deg,rgb(var(--cinnabar)),rgb(var(--surface-2)),rgb(var(--bamboo)))] dark:bg-[linear-gradient(90deg,rgb(var(--cinnabar)),rgb(var(--surface-1)),rgb(255,252,239))]"
                />
                <span className="text-[11px] font-semibold text-slate-500">They paid selected</span>
              </div>
            </div>
          ) : null}
        </div>

        <div className="overflow-y-auto bg-white p-5">
          {loading ? (
            <div className="flex h-[480px] items-center justify-center rounded-[10px] border border-slate-200 bg-slate-50 text-sm font-semibold text-slate-500">
              Loading network…
            </div>
          ) : viewMode === 'graph' ? (
            <NetworkGraph
              data={networkData}
              labels={labels}
              egoEntity={egoPlayerId || null}
              minWeight={minGames}
              netPointsWithEgo={netPointsWithEgo}
              onNodeClick={handleNodeClick}
              height={480}
            />
          ) : tableRows.length === 0 ? (
            <div className="flex h-[320px] items-center justify-center rounded-[10px] border border-dashed border-slate-300 bg-slate-50 text-sm font-semibold text-slate-500">
              No player pairs match these filters.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface-1))]">
              <table className="min-w-full border-separate border-spacing-0 text-sm text-[rgb(var(--ink))]">
                <thead>
                  <tr className="bg-[rgb(var(--surface-2))] text-left text-xs font-bold uppercase tracking-[0.12em] text-[rgb(var(--muted))]">
                    {egoPlayerId ? (
                      <>
                        <th className="border-b border-[rgb(var(--line))] px-4 py-3">
                          <button type="button" onClick={() => toggleTableSort('opponent')} className="group flex w-full items-center gap-1">
                            Opponent
                            <span aria-hidden="true" className={`transition-opacity ${tableSort === 'opponent' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{sortMark('opponent')}</span>
                          </button>
                        </th>
                        <th className="border-b border-[rgb(var(--line))] px-4 py-3">
                          <button type="button" onClick={() => toggleTableSort('gamesTogether')} className="group flex w-full items-center gap-1">
                            Games together
                            <span aria-hidden="true" className={`transition-opacity ${tableSort === 'gamesTogether' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{sortMark('gamesTogether')}</span>
                          </button>
                        </th>
                        <th className="border-b border-[rgb(var(--line))] px-4 py-3">
                          <button type="button" onClick={() => toggleTableSort('net')} className="group flex w-full items-center gap-1">
                            Net vs {egoName}
                            <span aria-hidden="true" className={`transition-opacity ${tableSort === 'net' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{sortMark('net')}</span>
                          </button>
                        </th>
                      </>
                    ) : (
                      <>
                        <th className="border-b border-[rgb(var(--line))] px-4 py-3">
                          <button type="button" onClick={() => toggleTableSort('playerA')} className="group flex w-full items-center gap-1">
                            Player A
                            <span aria-hidden="true" className={`transition-opacity ${tableSort === 'playerA' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{sortMark('playerA')}</span>
                          </button>
                        </th>
                        <th className="border-b border-[rgb(var(--line))] px-4 py-3">
                          <button type="button" onClick={() => toggleTableSort('playerB')} className="group flex w-full items-center gap-1">
                            Player B
                            <span aria-hidden="true" className={`transition-opacity ${tableSort === 'playerB' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{sortMark('playerB')}</span>
                          </button>
                        </th>
                        <th className="border-b border-[rgb(var(--line))] px-4 py-3">
                          <button type="button" onClick={() => toggleTableSort('gamesTogether')} className="group flex w-full items-center gap-1">
                            Games together
                            <span aria-hidden="true" className={`transition-opacity ${tableSort === 'gamesTogether' ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>{sortMark('gamesTogether')}</span>
                          </button>
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((row) => (
                    <tr key={row.key} className="odd:bg-[rgb(var(--surface-1))] even:bg-[rgb(var(--surface-2))]">
                      {egoPlayerId ? (
                        <>
                          <td className="border-b border-[rgb(var(--line)/.45)] px-4 py-2.5 font-semibold text-[rgb(var(--ink))]">
                            {row.opponentId ? (
                              <button
                                type="button"
                                onClick={() => setEgoPlayerId(row.opponentId!)}
                                className="text-left text-[rgb(var(--ink))] hover:text-[rgb(var(--bamboo-bright))]"
                              >
                                {row.opponentName}
                              </button>
                            ) : row.opponentName}
                          </td>
                          <td className="border-b border-[rgb(var(--line)/.45)] px-4 py-2.5 font-mono font-bold text-[rgb(var(--ink))]">
                            {row.gamesTogether}
                          </td>
                          <td className={`border-b border-[rgb(var(--line)/.45)] px-4 py-2.5 font-mono font-bold ${
                            (row.net ?? 0) > 0
                              ? 'text-[rgb(var(--bamboo))] dark:text-[rgb(var(--bamboo-bright))]'
                              : (row.net ?? 0) < 0
                                ? 'text-[rgb(var(--cinnabar))]'
                                : 'text-[rgb(var(--muted))]'
                          }`}
                          >
                            {formatNet(row.net ?? 0)}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="border-b border-[rgb(var(--line)/.45)] px-4 py-2.5 font-semibold text-[rgb(var(--ink))]">{row.playerA}</td>
                          <td className="border-b border-[rgb(var(--line)/.45)] px-4 py-2.5 font-semibold text-[rgb(var(--ink))]">{row.playerB}</td>
                          <td className="border-b border-[rgb(var(--line)/.45)] px-4 py-2.5 font-mono font-bold text-[rgb(var(--ink))]">{row.gamesTogether}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
