'use client'

import { useEffect, useMemo, useState } from 'react'
import { subscribePlayerStats, subscribePlayers } from '@/lib/firestore'
import type { PlayerDoc, PlayerStatsDoc } from '@/lib/types'
import { titleForStanding } from '@/lib/players'

function formatSigned(value: number) {
  if (value > 0) return `+${value}`
  return String(value)
}

function formatWinRate(wins: number, games: number) {
  if (!games) return '0%'
  return `${Math.round((wins / games) * 100)}%`
}

export function LeaderboardPanel({ clubId, seasonNumber, compact = false }: { clubId: string; seasonNumber?: number; compact?: boolean }) {
  const [players, setPlayers] = useState<PlayerDoc[]>([])
  const [stats, setStats] = useState<PlayerStatsDoc[]>([])

  useEffect(() => subscribePlayers(clubId, (nextPlayers) => setPlayers(nextPlayers)), [clubId])
  useEffect(() => subscribePlayerStats(clubId, (nextStats) => setStats(nextStats), seasonNumber), [clubId, seasonNumber])

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
    <section className="leaderboard-board overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Leaderboard</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">Current club standings</h2>
          <p className="text-sm font-medium text-slate-500">{rows.length} ranked players</p>
        </div>
      </header>

      {visibleRows.length > 0 ? (
        <>
          <div className="divide-y divide-slate-200 md:hidden">
            {visibleRows.map((row, index) => (
              <article key={row.playerId} className="p-4">
                <div className="flex items-start gap-3">
                  <span className="flex min-h-11 min-w-11 items-center justify-center rounded border border-slate-200 bg-slate-50 text-lg">{row.icon}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2"><h3 className="truncate text-base font-extrabold text-slate-950">{row.displayName}</h3><span className="font-mono text-xl font-bold text-[rgb(var(--cinnabar))]">#{row.pointsRank || index + 1}</span></div>
                    <p className="mt-1 text-xs text-slate-500">{titleForStanding(index + 1, rows.length, row.gamesPlayed)}</p>
                  </div>
                </div>
                <dl className="mt-4 grid grid-cols-3 gap-2 border-t border-slate-200 pt-3">
                  <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Points</dt><dd className="mt-1 font-mono text-sm font-bold text-slate-900">{row.totalPoints}</dd></div>
                  <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">ELO</dt><dd className="mt-1 font-mono text-sm font-bold text-slate-900">{row.eloRating}</dd></div>
                  <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Win rate</dt><dd className="mt-1 font-mono text-sm font-bold text-slate-900">{formatWinRate(row.gamesWon, row.gamesPlayed)}</dd></div>
                  <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Games</dt><dd className="mt-1 font-mono text-sm font-bold text-slate-900">{row.gamesPlayed}</dd></div>
                  <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Wins</dt><dd className="mt-1 font-mono text-sm font-bold text-slate-900">{row.gamesWon}</dd></div>
                  <div><dt className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Losses</dt><dd className="mt-1 font-mono text-sm font-bold text-slate-900">{row.gamesLost}</dd></div>
                </dl>
              </article>
            ))}
          </div>
          <div className="hidden overflow-x-auto md:block">
          <div className="min-w-[1020px]">
            <div className="grid grid-cols-[64px_minmax(280px,1.8fr)_88px_112px_76px_76px_84px_116px] gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              <span>Rank</span>
              <span>Name</span>
              <span>Points</span>
              <span>ELO</span>
              <span>Games</span>
              <span>Wins</span>
              <span>Losses</span>
              <span>Win ratio</span>
            </div>
            {visibleRows.map((row, index) => (
              <div
                key={row.playerId}
                className="leaderboard-row grid grid-cols-[64px_minmax(280px,1.8fr)_88px_112px_76px_76px_84px_116px] gap-3 border-b border-slate-200/70 px-4 py-4 last:border-b-0 hover:bg-[rgb(var(--bamboo)/0.045)]"
              >
                <div className="flex items-center font-display text-xl font-black text-[rgb(var(--cinnabar))]">#{row.pointsRank || '-'}</div>
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 text-sm font-bold text-slate-700">
                    {row.icon}
                  </span>
                  <div className="min-w-0">
                    <p className="break-words text-sm font-bold text-slate-900">{row.displayName}</p>
                    <p className="break-words text-xs leading-5 text-slate-500">
                      {titleForStanding(index + 1, rows.length, row.gamesPlayed)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center text-sm font-semibold text-slate-700">{row.totalPoints}</div>
                <div className="flex items-center text-sm font-semibold text-slate-700">{row.eloRating}</div>
                <div className="flex items-center text-sm font-semibold text-slate-700">{row.gamesPlayed}</div>
                <div className="flex items-center text-sm font-semibold text-slate-700">{row.gamesWon}</div>
                <div className="flex items-center text-sm font-semibold text-slate-700">{row.gamesLost}</div>
                <div className="flex items-center text-sm font-semibold text-slate-700">{formatWinRate(row.gamesWon, row.gamesPlayed)}</div>
              </div>
            ))}
          </div>
        </div>
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
      <div />
    </main>
  )
}
