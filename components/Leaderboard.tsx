'use client'

import { useEffect, useMemo, useState } from 'react'
import { subscribePlayerStats, subscribePlayers } from '@/lib/firestore'
import type { PlayerDoc, PlayerStatsDoc } from '@/lib/types'

function formatSigned(value: number) {
  if (value > 0) return `+${value}`
  return String(value)
}

export function LeaderboardPanel({ compact = false }: { compact?: boolean }) {
  const [players, setPlayers] = useState<PlayerDoc[]>([])
  const [stats, setStats] = useState<PlayerStatsDoc[]>([])

  useEffect(() => subscribePlayers((nextPlayers) => setPlayers(nextPlayers)), [])
  useEffect(() => subscribePlayerStats((nextStats) => setStats(nextStats)), [])

  const rows = useMemo(() => {
    return stats
      .map((entry) => {
        const player = players.find((item) => item.id === entry.playerId)
        return {
          ...entry,
          displayName: player?.displayName ?? entry.playerId,
          icon: player?.icon ?? 'M',
          title: player?.title ?? 'Player'
        }
      })
      .sort((a, b) => {
        const rankA = a.pointsRank || Number.MAX_SAFE_INTEGER
        const rankB = b.pointsRank || Number.MAX_SAFE_INTEGER
        return rankA - rankB || b.totalPoints - a.totalPoints
      })
  }, [players, stats])

  const visibleRows = compact ? rows.slice(0, 8) : rows

  return (
    <section className="overflow-hidden rounded-lg border border-zinc-200/70 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <header className="border-b border-zinc-200/70 px-5 py-4 dark:border-zinc-800">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-blue-500">Leaderboard</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">Current club standings</h2>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{rows.length} ranked players</p>
        </div>
      </header>

      {visibleRows.length > 0 ? (
        <>
          <div className="grid grid-cols-[48px_1fr_72px_72px] gap-3 border-b border-zinc-200 px-4 py-3 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500 dark:border-zinc-800 dark:text-zinc-400 sm:grid-cols-[60px_1.4fr_88px_104px_72px_72px]">
            <span>Rank</span>
            <span>Name</span>
            <span className="hidden sm:block">Points</span>
            <span className="hidden sm:block">ELO</span>
            <span>Wins</span>
            <span>Losses</span>
          </div>
          {visibleRows.map((row) => (
            <div
              key={row.playerId}
              className="grid grid-cols-[48px_1fr_72px_72px] gap-3 border-b border-zinc-200/70 px-4 py-4 last:border-b-0 dark:border-zinc-800/70 sm:grid-cols-[60px_1.4fr_88px_104px_72px_72px]"
            >
              <div className="flex items-center text-sm font-semibold text-zinc-700 dark:text-zinc-200">#{row.pointsRank || '-'}</div>
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-sm font-semibold text-blue-700 dark:bg-blue-950 dark:text-blue-200">
                  {row.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-zinc-900 dark:text-zinc-100">{row.displayName}</p>
                  <p className="truncate text-xs text-zinc-500">
                    {row.title} &middot; {row.eloRating} ELO &middot; {formatSigned(Math.round(row.last5EloDelta))} last 5
                  </p>
                </div>
              </div>
              <div className="hidden text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:block">{row.totalPoints}</div>
              <div className="hidden text-sm font-medium text-zinc-700 dark:text-zinc-200 sm:block">#{row.eloRank || '-'} &middot; {row.eloRating}</div>
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{row.gamesWon}</div>
              <div className="text-sm font-medium text-zinc-700 dark:text-zinc-200">{row.gamesLost}</div>
            </div>
          ))}
        </>
      ) : (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">No leaderboard data yet.</p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">Add a game to create standings.</p>
        </div>
      )}
    </section>
  )
}

export default function Leaderboard() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-4 px-4 py-6">
      <LeaderboardPanel />
    </main>
  )
}
