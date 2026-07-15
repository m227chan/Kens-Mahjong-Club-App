'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
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
        const rankA = a.skillRank || Number.MAX_SAFE_INTEGER
        const rankB = b.skillRank || Number.MAX_SAFE_INTEGER
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
      value: top.map((stat) => ({ id: stat.playerId, label: playerName(stat.playerId, true), value: Math.abs(stat.skillRank - stat.pointsRank) })),
      color: '#18694f',
      description: 'Lower is better. Compares experience-aware Skill rank to points rank.'
    },
    {
      title: 'Skill Headroom',
      value: top.map((stat) => ({ id: stat.playerId, label: playerName(stat.playerId, true), value: Math.max(0, stat.skillPeak - stat.skillRating) })),
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
      title: 'Last 5 Skill',
      value: top.map((stat) => ({ id: stat.playerId, label: playerName(stat.playerId, true), value: stat.last5SkillDelta })),
      color: '#b9392c',
      description: 'Recent rating movement across the latest games.'
    }
  ]

  const pointsDistribution = useMemo(() => {
    return playerStats
      .map((stat) => ({ id: stat.playerId, name: playerName(stat.playerId), points: stat.totalPoints }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
  // playerName is derived from the players subscription used by this memo.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playerStats, players])

  return (
    <section id="analytics" className="rounded-lg border border-slate-200 bg-white shadow-sm">
      <header className="border-b border-slate-200 px-5 py-4">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Analytics</p>
        <h2 className="mt-2 text-lg font-bold text-slate-900">Club insights</h2>
      </header>

      {top.length > 0 ? (
        <div className="grid gap-4 p-5">
          <article className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-4">
            <h3 className="text-sm font-bold text-slate-800">Player points</h3>
            <p className="mt-1 text-xs font-medium text-slate-500">Every selected player, ordered from highest to lowest cumulative points.</p>
            <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 bg-white px-2 pt-4">
              <div style={{ minWidth: Math.max(680, pointsDistribution.length * 34), height: 390 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={pointsDistribution} margin={{ top: 10, right: 18, left: 8, bottom: 92 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#dbe3e8" />
                    <XAxis dataKey="name" interval={0} angle={-60} textAnchor="end" height={95} tick={{ fontSize: 11, fill: '#475569' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#475569' }} width={58} />
                    <ReferenceLine y={0} stroke="#64748b" />
                    <Tooltip formatter={(value) => [Number(value).toLocaleString(), 'Points']} cursor={{ fill: 'rgba(24,105,79,.06)' }} />
                    <Bar dataKey="points" radius={[3, 3, 0, 0]}>
                      {pointsDistribution.map((entry) => <Cell key={entry.id} fill={entry.points >= 0 ? '#2f80ed' : '#e05a47'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </article>
          <div className="grid gap-4 md:grid-cols-2">
            {cards.map((card) => (
              <article key={card.title} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-bold text-slate-800">{card.title}</h3>
                <p className="mt-1 text-xs font-medium text-slate-500">{card.description}</p>
                <MiniBarChart data={card.value} color={card.color} />
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="px-5 py-10 text-center text-sm font-medium text-slate-500">Record games to unlock analytics.</div>
      )}
    </section>
  )
}
