'use client'

import { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { subscribeEloEvents, subscribeGames, subscribePlayerStats, subscribePlayers } from '@/lib/firestore'
import type { EloEventDoc, GameDoc, PlayerDoc, PlayerStatsDoc } from '@/lib/types'

const palette = ['#0A84FF', '#34D399', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316', '#64748b']

export default function DashboardContent() {
  const [games, setGames] = useState<GameDoc[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStatsDoc[]>([])
  const [players, setPlayers] = useState<PlayerDoc[]>([])
  const [eloEvents, setEloEvents] = useState<EloEventDoc[]>([])

  useEffect(() => subscribePlayers((nextPlayers) => setPlayers(nextPlayers)), [])
  useEffect(() => subscribeGames((nextGames) => setGames(nextGames)), [])
  useEffect(() => subscribePlayerStats((nextStats) => setPlayerStats(nextStats)), [])
  useEffect(() => subscribeEloEvents((nextEvents) => setEloEvents(nextEvents)), [])

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

  const cumulativeData = useMemo(() => {
    const sortedGames = [...games].sort((a, b) => Number(a.datetime) - Number(b.datetime))
    const runningTotals: Record<string, number> = {}

    return sortedGames.map((game, index) => {
      const row: { label: string; [key: string]: number | string } = { label: `Game ${index + 1}` }
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
  }, [displayPlayers, games, players])

  const bumpChartData = useMemo(() => {
    const sortedEvents = [...eloEvents].sort((a, b) => Number(a.datetime) - Number(b.datetime))
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
  }, [eloEvents, topPlayers])

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
        <h2 className="mt-2 text-lg font-bold text-slate-900">Club performance</h2>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800">Cumulative score chart</h3>
          <div className="mt-4 h-72">
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
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-bold text-slate-800">ELO rank bump chart</h3>
          <p className="mt-2 text-sm text-slate-500">Shows how top players&apos; rank changes across games.</p>
          <div className="mt-4 h-72">
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
        </div>
      </section>
    </div>
  )
}
