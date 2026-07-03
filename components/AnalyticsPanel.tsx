'use client'

import { useEffect, useMemo, useState } from 'react'
import { subscribePlayerStats, subscribePlayers } from '@/lib/firestore'
import type { PlayerDoc, PlayerStatsDoc } from '@/lib/types'

function MiniBarChart({ data, color = '#667eea' }: { data: Array<{ label: string; value: number }>; color?: string }) {
  const max = Math.max(...data.map((entry) => Math.abs(entry.value)), 1)

  return (
    <div className="mt-4 flex h-32 items-end gap-2">
      {data.map((entry) => (
        <div key={entry.label} className="flex min-w-0 flex-1 flex-col items-center gap-2">
          <div
            className="w-full rounded-t-md"
            style={{ height: `${Math.max(10, (Math.abs(entry.value) / max) * 100)}%`, backgroundColor: color }}
            title={`${entry.label}: ${Math.round(entry.value * 10) / 10}`}
          />
          <span className="max-w-full truncate text-[10px] font-medium text-slate-500">{entry.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPanel() {
  const [playerStats, setPlayerStats] = useState<PlayerStatsDoc[]>([])
  const [players, setPlayers] = useState<PlayerDoc[]>([])

  useEffect(() => subscribePlayerStats((nextStats) => setPlayerStats(nextStats)), [])
  useEffect(() => subscribePlayers((nextPlayers) => setPlayers(nextPlayers)), [])

  const top = useMemo(() => {
    return [...playerStats].sort((a, b) => a.eloRank - b.eloRank).slice(0, 8)
  }, [playerStats])

  const playerName = (playerId: string, short = false) => {
    const name = players.find((player) => player.id === playerId)?.displayName ?? playerId
    return short ? name.slice(0, 4) : name
  }

  const cards = [
    {
      title: 'Rank Alignment',
      value: top.map((stat) => ({ label: playerName(stat.playerId, true), value: Math.abs(stat.eloRank - stat.pointsRank) })),
      color: '#667eea'
    },
    {
      title: 'ELO Headroom',
      value: top.map((stat) => ({ label: playerName(stat.playerId, true), value: Math.max(0, stat.eloPeak - stat.eloRating) })),
      color: '#48bb78'
    },
    {
      title: 'Points / Game',
      value: top.map((stat) => ({ label: playerName(stat.playerId, true), value: stat.gamesPlayed ? stat.totalPoints / stat.gamesPlayed : 0 })),
      color: '#f6ad55'
    },
    {
      title: 'Last 5 ELO',
      value: top.map((stat) => ({ label: playerName(stat.playerId, true), value: stat.last5EloDelta })),
      color: '#fc8181'
    }
  ]

  return (
    <section id="analytics" className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Analytics</p>
        <h2 className="mt-2 text-lg font-bold text-slate-900">Club insights</h2>
      </header>

      {top.length > 0 ? (
        <div className="grid gap-4 p-5 md:grid-cols-2">
          {cards.map((card) => (
            <article key={card.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-bold text-slate-800">{card.title}</h3>
              <MiniBarChart data={card.value} color={card.color} />
            </article>
          ))}
        </div>
      ) : (
        <div className="px-5 py-10 text-center text-sm font-medium text-slate-500">Record games to unlock analytics.</div>
      )}
    </section>
  )
}
