'use client'

import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { subscribeEloEvents, subscribeGames, subscribePlayerStats, subscribePlayers } from '@/lib/firestore'
import type { EloEventDoc, GameDoc, PlayerDoc, PlayerStatsDoc } from '@/lib/types'

const palette = ['#0A84FF', '#34D399', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#64748b']
const gameRangeOptions = [
  { label: 'Last 25', value: 25 },
  { label: 'Last 50', value: 50 },
  { label: 'Last 100', value: 100 },
  { label: 'All', value: 0 }
]

function timestampMillis(value: GameDoc['datetime'] | EloEventDoc['datetime']) {
  return value?.toMillis?.() ?? 0
}

export default function DashboardContent({ clubId, seasonNumber }: { clubId: string; seasonNumber?: number }) {
  const [games, setGames] = useState<GameDoc[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStatsDoc[]>([])
  const [players, setPlayers] = useState<PlayerDoc[]>([])
  const [eloEvents, setEloEvents] = useState<EloEventDoc[]>([])
  const [gameRange, setGameRange] = useState(50)

  useEffect(() => subscribePlayers(clubId, (nextPlayers) => setPlayers(nextPlayers)), [clubId])
  useEffect(() => subscribeGames(clubId, (nextGames) => setGames(nextGames), seasonNumber), [clubId, seasonNumber])
  useEffect(() => subscribePlayerStats(clubId, (nextStats) => setPlayerStats(nextStats), seasonNumber), [clubId, seasonNumber])
  useEffect(() => subscribeEloEvents(clubId, (nextEvents) => setEloEvents(nextEvents), seasonNumber), [clubId, seasonNumber])

  const topPlayers = useMemo(() => {
    return playerStats
      .slice()
      .sort((a, b) => a.eloRank - b.eloRank)
      .slice(0, 8)
      .map((stat) => stat.playerId)
  }, [playerStats])

  const displayPlayers = useMemo(() => {
    return topPlayers.map((playerId) => players.find((player) => player.id === playerId)?.displayName ?? playerId)
  }, [players, topPlayers])

  const sortedGames = useMemo(() => {
    return [...games].sort((a, b) => timestampMillis(a.datetime) - timestampMillis(b.datetime))
  }, [games])

  const visibleGames = useMemo(() => {
    return gameRange === 0 ? sortedGames : sortedGames.slice(-gameRange)
  }, [gameRange, sortedGames])

  const visibleGameIds = useMemo(() => new Set(visibleGames.map((game) => game.id)), [visibleGames])

  const cumulativeData = useMemo(() => {
    const runningTotals: Record<string, number> = {}
    const firstVisibleIndex = Math.max(0, sortedGames.length - visibleGames.length)

    return visibleGames.map((game, index) => {
      const row: { label: string; [key: string]: number | string } = { label: `Game ${firstVisibleIndex + index + 1}` }
      game.entries.forEach((entry) => {
        const playerName = players.find((player) => player.id === entry.playerId)?.displayName ?? entry.playerId
        runningTotals[playerName] = (runningTotals[playerName] ?? 0) + entry.score
        row[playerName] = runningTotals[playerName]
      })
      displayPlayers.forEach((playerName) => {
        if (row[playerName] === undefined) {
          row[playerName] = runningTotals[playerName] ?? 0
        }
      })
      return row
    })
  }, [displayPlayers, players, sortedGames.length, visibleGames])

  const bumpChartData = useMemo(() => {
    const sortedEvents = [...eloEvents]
      .filter((event) => visibleGameIds.has(event.gameId))
      .sort((a, b) => timestampMillis(a.datetime) - timestampMillis(b.datetime))
    const gameIds = Array.from(new Set(sortedEvents.map((event) => event.gameId)))

    return gameIds.map((gameId, index) => {
      const gameEvents = sortedEvents.filter((event) => event.gameId === gameId)
      const ranks = [...gameEvents]
        .sort((a, b) => b.ratingAfter - a.ratingAfter)
        .reduce<Record<string, number>>((acc, event, rankIndex) => {
          acc[event.playerId] = rankIndex + 1
          return acc
        }, {})

      const row: { label: string; [key: string]: number | string } = { label: `Game ${index + 1}` }
      topPlayers.forEach((playerId) => {
        row[playerId] = ranks[playerId] ?? NaN
      })
      return row
    })
  }, [eloEvents, topPlayers, visibleGameIds])

  const bumpDisplayData = useMemo(() => {
    return bumpChartData.map((row) => {
      const displayRow: { label: string; [key: string]: number | string } = { label: row.label }
      topPlayers.forEach((playerId) => {
        displayRow[players.find((player) => player.id === playerId)?.displayName ?? playerId] = row[playerId]
      })
      return displayRow
    })
  }, [bumpChartData, players, topPlayers])

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

      <section className="grid gap-5">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800">Cumulative score chart</h3>
          {cumulativeData.length > 0 ? (
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={cumulativeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis tick={{ fill: '#64748b', fontSize: 12 }} />
                  <Tooltip />
                  {displayPlayers.map((player, index) => (
                    <Line
                      key={player}
                      type="monotone"
                      dataKey={player}
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
              Record games to draw the cumulative score chart.
            </div>
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800">ELO rank bump chart</h3>
          <p className="mt-2 text-sm text-slate-500">Shows how top players&apos; rank changes across games.</p>
          {bumpDisplayData.length > 0 ? (
            <div className="mt-4 h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={bumpDisplayData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#94a3b8" opacity={0.2} />
                  <XAxis dataKey="label" tick={{ fill: '#64748b', fontSize: 12 }} />
                  <YAxis reversed tick={{ fill: '#64748b', fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  {displayPlayers.map((player, index) => (
                    <Line
                      key={player}
                      type="monotone"
                      dataKey={player}
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
              Record games to draw the ELO rank chart.
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
