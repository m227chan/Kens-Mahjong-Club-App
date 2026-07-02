'use client'

import { useEffect, useMemo, useState } from 'react'
import { subscribePlayerStats, subscribePlayers } from '@/lib/firestore'
import type { PlayerDoc, PlayerStatsDoc } from '@/lib/types'

export default function Leaderboard() {
  const [players, setPlayers] = useState<PlayerDoc[]>([])
  const [stats, setStats] = useState<PlayerStatsDoc[]>([])

  useEffect(() => subscribePlayers((nextPlayers) => setPlayers(nextPlayers)), [])
  useEffect(() => subscribePlayerStats((nextStats) => setStats(nextStats)), [])

  const rows = useMemo(() => {
    return stats
      .map((entry) => ({
        ...entry,
        displayName: players.find((player) => player.id === entry.playerId)?.displayName ?? entry.playerId,
        icon: players.find((player) => player.id === entry.playerId)?.icon ?? '🧘'
      }))
      .sort((a, b) => a.pointsRank - b.pointsRank)
  }, [players, stats])

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-4 py-6">
      <header className="rounded-[24px] border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-500">Leaderboard</p>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Current club standings</h1>
      </header>

      <section className="overflow-hidden rounded-[24px] border border-zinc-200/70 bg-white/80 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="grid grid-cols-[48px_1fr_80px_80px] gap-3 border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 sm:grid-cols-[64px_1.4fr_96px_96px_96px_96px]">
          <span>Rank</span>
          <span>Name</span>
          <span className="hidden sm:block">Points</span>
          <span className="hidden sm:block">ELO</span>
          <span>Wins</span>
          <span>Losses</span>
        </div>
        {rows.map((row) => (
          <div key={row.playerId} className="grid grid-cols-[48px_1fr_80px_80px] gap-3 border-b border-zinc-200/70 px-4 py-4 last:border-b-0 dark:border-zinc-800/70 sm:grid-cols-[64px_1.4fr_96px_96px_96px_96px]">
            <div className="flex items-center text-sm font-semibold text-zinc-700 dark:text-zinc-200">#{row.pointsRank}</div>
            <div className="flex items-center gap-3">
              <span className="text-lg">{row.icon}</span>
              <div>
                <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{row.displayName}</p>
                <p className="text-xs text-zinc-500">{row.eloRating} ELO</p>
              </div>
            </div>
            <div className="hidden text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:block">{row.totalPoints}</div>
            <div className="hidden text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:block">{row.eloRating}</div>
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{row.gamesWon}</div>
            <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{row.gamesLost}</div>
          </div>
        ))}
      </section>
    </main>
  )
}