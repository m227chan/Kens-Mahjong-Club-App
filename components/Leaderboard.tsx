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
    <section className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Leaderboard</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Current club standings</h2>
          <p className="text-sm font-medium text-slate-500">{rows.length} ranked players</p>
        </div>
      </header>

      {visibleRows.length > 0 ? (
        <>
          <div className="grid grid-cols-[48px_1fr_72px_72px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500 sm:grid-cols-[60px_1.4fr_88px_104px_72px_72px]">
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
              className="grid grid-cols-[48px_1fr_72px_72px] gap-3 border-b border-slate-200/70 px-4 py-4 last:border-b-0 sm:grid-cols-[60px_1.4fr_88px_104px_72px_72px]"
            >
              <div className="flex items-center text-sm font-bold text-slate-700">#{row.pointsRank || '-'}</div>
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700">
                  {row.icon}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-900">{row.displayName}</p>
                  <p className="truncate text-xs text-slate-500">
                    {row.title} &middot; {row.eloRating} ELO &middot; {formatSigned(Math.round(row.last5EloDelta))} last 5
                  </p>
                </div>
              </div>
              <div className="hidden text-sm font-semibold text-slate-700 sm:block">{row.totalPoints}</div>
              <div className="hidden text-sm font-semibold text-slate-700 sm:block">#{row.eloRank || '-'} &middot; {row.eloRating}</div>
              <div className="text-sm font-semibold text-slate-700">{row.gamesWon}</div>
              <div className="text-sm font-semibold text-slate-700">{row.gamesLost}</div>
            </div>
          ))}
        </>
      ) : (
        <div className="px-5 py-10 text-center">
          <p className="text-sm font-bold text-slate-700">No leaderboard data yet.</p>
          <p className="mt-1 text-sm text-slate-500">Record a game in the session manager to create standings.</p>
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
