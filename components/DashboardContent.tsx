'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { loadAnalyticsGames, loadAnalyticsSkillEvents, subscribeActiveSession, subscribePlayerStats, subscribePlayers } from '@/lib/data'
import type { GameDoc, PlayerDoc, PlayerStatsDoc, SessionDoc, SkillEventDoc } from '@/lib/types'
import AnalyticsPanel from '@/components/AnalyticsPanel'

const palette = ['#18694f', '#b9392c', '#c18b30', '#28666e', '#744c24', '#8c3f65', '#4f772d', '#264653']
const gameRangeOptions = [
  { label: 'Last 25', value: 25 },
  { label: 'Last 50', value: 50 },
  { label: 'Last 100', value: 100 },
  { label: 'All', value: 0 }
]

function timestampMillis(value: GameDoc['datetime'] | SkillEventDoc['datetime']) {
  return value?.toMillis?.() ?? 0
}

function shortDate(value: GameDoc['datetime'] | SkillEventDoc['datetime']) {
  const date = value?.toDate?.()
  return date ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: '2-digit' }).format(date) : ''
}

export default function DashboardContent({ clubId, seasonNumber }: { clubId: string; seasonNumber?: number }) {
  const [games, setGames] = useState<GameDoc[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStatsDoc[]>([])
  const [players, setPlayers] = useState<PlayerDoc[]>([])
  const [skillEvents, setSkillEvents] = useState<SkillEventDoc[]>([])
  const [session, setSession] = useState<SessionDoc | null | undefined>(undefined)
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [playerSearch, setPlayerSearch] = useState('')
  const [gameRange, setGameRange] = useState(50)
  const initializedSelection = useRef('')

  useEffect(() => subscribePlayers(clubId, (nextPlayers) => setPlayers(nextPlayers)), [clubId])
  useEffect(() => subscribePlayerStats(clubId, (nextStats) => setPlayerStats(nextStats), seasonNumber), [clubId, seasonNumber])
  useEffect(() => subscribeActiveSession(clubId, seasonNumber ?? 1, setSession), [clubId, seasonNumber])
  useEffect(() => {
    let cancelled = false
    void Promise.all([
      loadAnalyticsGames(clubId, gameRange, seasonNumber),
      loadAnalyticsSkillEvents(clubId, gameRange, seasonNumber)
    ]).then(([nextGames, nextEvents]) => {
      if (!cancelled) { setGames(nextGames); setSkillEvents(nextEvents) }
    }).catch(() => {
      if (!cancelled) { setGames([]); setSkillEvents([]) }
    })
    return () => { cancelled = true }
  }, [clubId, gameRange, seasonNumber])

  const topPlayers = useMemo(() => {
    return playerStats
      .slice()
      .sort((a, b) => a.skillRank - b.skillRank)
      .slice(0, 8)
      .map((stat) => stat.playerId)
  }, [playerStats])

  useEffect(() => {
    if (session === undefined) return
    const sessionIds = session?.participants.filter((id) => players.some((player) => player.id === id)) ?? []
    if (sessionIds.length === 0 && topPlayers.length === 0) return
    const key = sessionIds.length ? `session:${session?.id}:${sessionIds.join(',')}` : `fallback:${clubId}:${seasonNumber}`
    if (initializedSelection.current === key) return
    initializedSelection.current = key
    setSelectedPlayerIds(sessionIds.length ? sessionIds : topPlayers)
  }, [clubId, players, seasonNumber, session, topPlayers])

  const selectedPlayers = useMemo(() => selectedPlayerIds
    .map((id) => players.find((player) => player.id === id))
    .filter((player): player is PlayerDoc => Boolean(player)), [players, selectedPlayerIds])

  const searchedPlayers = useMemo(() => {
    const term = playerSearch.trim().toLocaleLowerCase()
    return players.filter((player) => !term || player.displayName.toLocaleLowerCase().includes(term))
  }, [playerSearch, players])

  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => timestampMillis(a.datetime) - timestampMillis(b.datetime))
  }, [games])

  const visibleGames = useMemo(() => {
    return gameRange === 0 ? sortedGames : sortedGames.slice(-gameRange)
  }, [gameRange, sortedGames])

  const visibleGameIds = useMemo(() => new Set(visibleGames.map((game) => game.id)), [visibleGames])

  const cumulativeData = useMemo(() => {
    const runningTotals: Record<string, number> = {}

    return visibleGames.map((game) => {
      const row: { label: string; [key: string]: number | string } = { label: shortDate(game.datetime) }
      game.entries.forEach((entry) => {
        runningTotals[entry.playerId] = (runningTotals[entry.playerId] ?? 0) + entry.score
        row[entry.playerId] = runningTotals[entry.playerId]
      })
      selectedPlayerIds.forEach((playerId) => {
        if (row[playerId] === undefined) {
          row[playerId] = runningTotals[playerId] ?? 0
        }
      })
      return row
    })
  }, [selectedPlayerIds, visibleGames])

  const bumpChartData = useMemo(() => {
    const sortedEvents = [...skillEvents].sort((a, b) => timestampMillis(a.datetime) - timestampMillis(b.datetime))
    const eventsByGame = new Map<string, SkillEventDoc[]>()
    sortedEvents.forEach((event) => eventsByGame.set(event.gameId, [...(eventsByGame.get(event.gameId) ?? []), event]))
    const ratings = new Map<string, number>()
    const rows: Array<{ label: string; [key: string]: number | string | null }> = []
    sortedGames.forEach((game) => {
      const gameEvents = eventsByGame.get(game.id) ?? []
      gameEvents.forEach((event) => ratings.set(event.playerId, event.ratingAfter))
      if (!visibleGameIds.has(game.id)) return
      const ranks = new Map([...ratings.entries()].sort((a, b) => b[1] - a[1]).map(([id], index) => [id, index + 1]))
      const row: { label: string; [key: string]: number | string | null } = { label: shortDate(game.datetime) }
      selectedPlayerIds.forEach((id) => { row[id] = ranks.get(id) ?? null })
      rows.push(row)
    })
    return rows
  }, [skillEvents, selectedPlayerIds, sortedGames, visibleGameIds])

  return (
    <div id="dashboard" className="space-y-5">
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Dashboard</p>
        <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Club performance</h2>
            <p className="mt-1 text-sm text-slate-500">
              Showing {visibleGames.length} of {sortedGames.length} recorded games.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {gameRangeOptions.map((option) => (
              <button
                key={option.label}
                type="button"
                onClick={() => setGameRange(option.value)}
                className={`rounded-lg border px-3 py-2 text-xs font-bold transition ${gameRange === option.value ? 'border-blue-500 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><h3 className="text-sm font-bold text-slate-800">Players shown</h3><p className="mt-1 text-xs text-slate-500">Defaults to the active session. Select only the players you want to compare.</p></div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelectedPlayerIds(session?.participants ?? [])} disabled={!session?.participants.length} className="rounded border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700 disabled:opacity-40">Session players</button>
            <button type="button" onClick={() => setSelectedPlayerIds([])} className="rounded border border-slate-300 px-3 py-2 text-xs font-bold text-slate-700">Clear all</button>
          </div>
        </div>
        <input value={playerSearch} onChange={(event) => setPlayerSearch(event.target.value)} placeholder="Search 50+ players…" className="mt-4 min-h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm text-slate-900 outline-none focus:border-[rgb(var(--bamboo))]" />
        <div className="mt-3 max-h-44 overflow-y-auto rounded border border-slate-200 bg-slate-50 p-2">
          <div className="grid gap-1 sm:grid-cols-2 lg:grid-cols-3">
            {searchedPlayers.map((player) => {
              const checked = selectedPlayerIds.includes(player.id)
              return (
                <label key={player.id} className={`flex min-h-10 cursor-pointer items-center gap-2 rounded px-2.5 py-2 text-sm font-semibold ${checked ? 'bg-[rgb(var(--bamboo))] text-white' : 'bg-white text-slate-700 hover:bg-slate-100'}`}>
                  <input type="checkbox" checked={checked} onChange={() => setSelectedPlayerIds((current) => checked ? current.filter((id) => id !== player.id) : [...current, player.id])} className="h-4 w-4" />
                  <span>{player.icon}</span><span className="truncate">{player.displayName}</span>
                </label>
              )
            })}
          </div>
        </div>
        <p className="mt-2 text-xs font-semibold text-slate-500">{selectedPlayerIds.length} player{selectedPlayerIds.length === 1 ? '' : 's'} selected</p>
      </section>

      <section className="grid gap-5">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800">Cumulative score chart</h3>
          {cumulativeData.length > 0 && selectedPlayers.length > 0 ? (
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fill: 'rgb(var(--muted))', fontSize: 12 }} />
                  <YAxis tick={{ fill: 'rgb(var(--muted))', fontSize: 12 }} />
                  <Tooltip />
                  {selectedPlayers.map((player, index) => (
                    <Line
                      key={player.id}
                      type="monotone"
                      dataKey={player.id}
                      name={player.displayName}
                      stroke={palette[index % palette.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm font-semibold text-slate-500">
              {selectedPlayers.length ? 'Record games to draw the cumulative score chart.' : 'Select one or more players to draw this chart.'}
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800">Skill rank bump chart</h3>
          <p className="mt-2 text-sm text-slate-500">Shows how selected players&apos; club rank changes over time.</p>
          {bumpChartData.length > 0 && selectedPlayers.length > 0 ? (
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bumpChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--line))" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fill: 'rgb(var(--muted))', fontSize: 12 }} />
                  <YAxis reversed tick={{ fill: 'rgb(var(--muted))', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  {selectedPlayers.map((player, index) => (
                    <Line
                      key={player.id}
                      type="monotone"
                      dataKey={player.id}
                      name={player.displayName}
                      stroke={palette[index % palette.length]}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm font-semibold text-slate-500">
              {selectedPlayers.length ? 'Record games to draw the Skill rank chart.' : 'Select one or more players to draw this chart.'}
            </div>
          )}
        </div>
      </section>
      <AnalyticsPanel clubId={clubId} seasonNumber={seasonNumber} selectedPlayerIds={selectedPlayerIds} />
    </div>
  )
}
