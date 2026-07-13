'use client'

import { useEffect, useMemo, useState } from 'react'
import { subscribePlayerStats, subscribePlayers } from '@/lib/data'
import type { PlayerDoc, PlayerStatsDoc } from '@/lib/types'

function MiniBarChart({ data, color = '#18694f' }: { data: Array<{ id: string; label: string; value: number }>; color?: string }) {
  const max = Math.max(...data.map((entry) => Math.abs(entry.value)), 1)

  return (
    <div className="mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-3">
      {data.map((entry) => (
        <div key={entry.id} className="grid grid-cols-[72px_1fr_48px] items-center gap-3">
          <span className="truncate text-xs font-semibold text-slate-600">{entry.label}</span>
          <div
            className="h-2 rounded-full bg-slate-100"
            title={`${entry.label}: ${Math.round(entry.value * 10) / 10}`}
          >
            <div
              className="h-2 rounded-full"
              style={{ width: `${entry.value === 0 ? 4 : Math.max(8, (Math.abs(entry.value) / max) * 100)}%`, backgroundColor: color }}
            />
          </div>
          <span className="text-right text-xs font-bold text-slate-700">{Math.round(entry.value * 10) / 10}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPanel({ clubId, seasonNumber, selectedPlayerIds }: { clubId: string; seasonNumber?: number; selectedPlayerIds?: string[] }) {
  const [playerStats, setPlayerStats] = useState<PlayerStatsDoc[]>([])
  const [players, setPlayers] = useState<PlayerDoc[]>([])

  useEffect(() => subscribePlayerStats(clubId, (nextStats) => setPlayerStats(nextStats), seasonNumber), [clubId, seasonNumber])
  useEffect(() => subscribePlayers(clubId, (nextPlayers) => setPlayers(nextPlayers)), [clubId])

  const top = useMemo(() => {
    const selected = selectedPlayerIds ? new Set(selectedPlayerIds) : null
    return [...playerStats]
      .filter((stat) => !selected || selected.has(stat.playerId))
      .sort((a, b) => {
        const rankA = a.eloRank || Number.MAX_SAFE_INTEGER
        const rankB = b.eloRank || Number.MAX_SAFE_INTEGER
        return rankA - rankB || b.gamesPlayed - a.gamesPlayed || b.totalPoints - a.totalPoints
      })
      .slice(0, selected ? selectedPlayerIds!.length : 8)
  }, [playerStats, selectedPlayerIds])

  const playerName = (playerId: string, short = false) => {
    const name = players.find((player) => player.id === playerId)?.displayName ?? playerId
    return short ? name.slice(0, 8) : name
  }

  const cards = [
    {
      title: 'Rank Alignment',
      value: top.map((stat) => ({ id: stat.playerId, label: playerName(stat.playerId, true), value: Math.abs(stat.eloRank - stat.pointsRank) })),
      color: '#18694f',
      description: 'Lower is better. Compares ELO rank to points rank.'
    },
    {
      title: 'ELO Headroom',
      value: top.map((stat) => ({ id: stat.playerId, label: playerName(stat.playerId, true), value: Math.max(0, stat.eloPeak - stat.eloRating) })),
      color: '#28666e',
      description: 'Distance from each player\'s peak rating.'
    },
    {
      title: 'Points / Game',
      value: top.map((stat) => ({ id: stat.playerId, label: playerName(stat.playerId, true), value: stat.gamesPlayed ? stat.totalPoints / stat.gamesPlayed : 0 })),
      color: '#c18b30',
      description: 'Average point result per recorded game.'
    },
    {
      title: 'Last 5 ELO',
      value: top.map((stat) => ({ id: stat.playerId, label: playerName(stat.playerId, true), value: stat.last5EloDelta })),
      color: '#b9392c',
      description: 'Recent rating movement across the latest games.'
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
              <p className="mt-1 text-xs font-medium text-slate-500">{card.description}</p>
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
