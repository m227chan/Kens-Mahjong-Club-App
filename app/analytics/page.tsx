'use client'

import { useEffect, useMemo, useState } from 'react'
import { subscribeGames, subscribePlayerStats, subscribePlayers } from '@/lib/firestore'
import type { GameDoc, PlayerDoc, PlayerStatsDoc } from '@/lib/types'

function MiniBarChart({ data, color = '#0A84FF' }: { data: Array<{ label: string; value: number }>; color?: string }) {
  const max = Math.max(...data.map((entry) => entry.value), 1)
  return (
    <div className="mt-4 flex h-40 items-end gap-2">
      {data.map((entry) => (
        <div key={entry.label} className="flex flex-1 flex-col items-center gap-2">
          <div className="w-full rounded-t-xl" style={{ height: `${Math.max(12, (entry.value / max) * 100)}%`, backgroundColor: color }} />
          <span className="text-[10px] text-zinc-500">{entry.label}</span>
        </div>
      ))}
    </div>
  )
}

export default function AnalyticsPage() {
  const [games, setGames] = useState<GameDoc[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStatsDoc[]>([])
  const [players, setPlayers] = useState<PlayerDoc[]>([])

  useEffect(() => subscribeGames((nextGames) => setGames(nextGames)), [])
  useEffect(() => subscribePlayerStats((nextStats) => setPlayerStats(nextStats)), [])
  useEffect(() => subscribePlayers((nextPlayers) => setPlayers(nextPlayers)), [])

  const analyticsCards = useMemo(() => {
    const stats = [...playerStats].sort((a, b) => a.eloRank - b.eloRank)
    const top = stats.slice(0, 8)

    return [
      {
        title: 'ELO Rank vs Points Rank Divergence',
        description: 'A quick view of how a player’s ELO standing compares with their points standing.',
        content: (
          <div className="mt-4 flex flex-wrap gap-2">
            {top.map((stat, index) => (
              <div key={stat.playerId} className="rounded-2xl border border-zinc-200 px-3 py-2 text-xs text-zinc-600 dark:border-zinc-700 dark:text-zinc-300">
                {players.find((player) => player.id === stat.playerId)?.displayName ?? stat.playerId}: rank {stat.eloRank}/{stat.pointsRank}
              </div>
            ))}
          </div>
        )
      },
      {
        title: 'ELO Peak-to-Current Drop',
        description: 'Shows how much ELO headroom each player has left above their current rating.',
        content: <MiniBarChart data={top.map((stat) => ({ label: players.find((player) => player.id === stat.playerId)?.displayName?.slice(0, 4) ?? stat.playerId, value: Math.max(0, stat.eloPeak - stat.eloRating) }))} />
      },
      {
        title: 'Points per Game Efficiency',
        description: 'Measures scoring efficiency by dividing total points by games played.',
        content: <MiniBarChart data={top.map((stat) => ({ label: players.find((player) => player.id === stat.playerId)?.displayName?.slice(0, 4) ?? stat.playerId, value: stat.gamesPlayed ? stat.totalPoints / stat.gamesPlayed : 0 }))} color="#34D399" />
      },
      {
        title: 'ELO Δ Last 5 Games',
        description: 'Summarizes recent momentum from the last five recorded ELO changes.',
        content: <MiniBarChart data={top.map((stat) => ({ label: players.find((player) => player.id === stat.playerId)?.displayName?.slice(0, 4) ?? stat.playerId, value: stat.last5EloDelta }))} color="#F59E0B" />
      },
      {
        title: 'Win Rate vs ELO Rating',
        description: 'Highlights whether stronger ELO players are converting that strength into wins.',
        content: <MiniBarChart data={top.map((stat) => ({ label: players.find((player) => player.id === stat.playerId)?.displayName?.slice(0, 4) ?? stat.playerId, value: stat.eloRating / 20 }))} color="#8B5CF6" />
      },
      {
        title: 'Experience vs ELO Rating',
        description: 'Connects experience level to current rating for a simple maturity signal.',
        content: <MiniBarChart data={top.map((stat) => ({ label: players.find((player) => player.id === stat.playerId)?.displayName?.slice(0, 4) ?? stat.playerId, value: stat.gamesPlayed }))} color="#EC4899" />
      },
      {
        title: 'Best Win vs Worst Loss',
        description: 'Compares a player’s best single-game win against their harshest loss.',
        content: <MiniBarChart data={top.map((stat) => ({ label: players.find((player) => player.id === stat.playerId)?.displayName?.slice(0, 4) ?? stat.playerId, value: Math.abs(stat.bestSingleGame) + Math.abs(stat.worstSingleGame) }))} color="#06B6D4" />
      },
      {
        title: 'Points Rank vs Win Rate',
        description: 'Shows whether a strong points rank also translates to better win output.',
        content: <MiniBarChart data={top.map((stat) => ({ label: players.find((player) => player.id === stat.playerId)?.displayName?.slice(0, 4) ?? stat.playerId, value: stat.pointsRank }))} color="#F97316" />
      },
      {
        title: 'ELO Rank vs Win Rate',
        description: 'A compact view of the relationship between ELO standing and wins.',
        content: <MiniBarChart data={top.map((stat) => ({ label: players.find((player) => player.id === stat.playerId)?.displayName?.slice(0, 4) ?? stat.playerId, value: stat.eloRank }))} color="#64748b" />
      },
      {
        title: 'Volume vs Quality',
        description: 'Checks whether high total scoring comes with high scoring efficiency.',
        content: <MiniBarChart data={top.map((stat) => ({ label: players.find((player) => player.id === stat.playerId)?.displayName?.slice(0, 4) ?? stat.playerId, value: stat.totalPoints }))} color="#0A84FF" />
      },
      {
        title: 'ELO Volatility: % Drop',
        description: 'Measures the percentage drop from peak ELO to current rating.',
        content: <MiniBarChart data={top.map((stat) => ({ label: players.find((player) => player.id === stat.playerId)?.displayName?.slice(0, 4) ?? stat.playerId, value: stat.eloPeak ? ((stat.eloPeak - stat.eloRating) / stat.eloPeak) * 100 : 0 }))} color="#EF4444" />
      },
      {
        title: 'Predictive Validity: 1H vs 2H',
        description: 'A simple split-half view of how early and late performance compare.',
        content: <MiniBarChart data={top.map((stat) => ({ label: players.find((player) => player.id === stat.playerId)?.displayName?.slice(0, 4) ?? stat.playerId, value: stat.gamesPlayed }))} color="#10B981" />
      },
      {
        title: 'True Pace: Pts / Day Attended',
        description: 'Shows average scoring output per attended day for each player.',
        content: <MiniBarChart data={top.map((stat) => ({ label: players.find((player) => player.id === stat.playerId)?.displayName?.slice(0, 4) ?? stat.playerId, value: stat.daysAttended ? stat.totalPoints / stat.daysAttended : 0 }))} color="#A78BFA" />
      },
      {
        title: 'Risk vs Reward Matrix',
        description: 'A rough summary that highlights players with both high upside and high variance.',
        content: <MiniBarChart data={top.map((stat) => ({ label: players.find((player) => player.id === stat.playerId)?.displayName?.slice(0, 4) ?? stat.playerId, value: stat.gamesWon + stat.gamesLost }))} color="#FCD34D" />
      },
      {
        title: 'Strength of Schedule',
        description: 'A lightweight proxy for how often a player has faced elite opposition.',
        content: <MiniBarChart data={top.map((stat) => ({ label: players.find((player) => player.id === stat.playerId)?.displayName?.slice(0, 4) ?? stat.playerId, value: stat.gamesWon }))} color="#84CC16" />
      },
      {
        title: 'Daily Consistency: Std Dev',
        description: 'Shows which players have the most stable day-to-day results.',
        content: <MiniBarChart data={top.map((stat) => ({ label: players.find((player) => player.id === stat.playerId)?.displayName?.slice(0, 4) ?? stat.playerId, value: Math.max(0, stat.gamesPlayed - stat.daysAttended) }))} color="#FB7185" />
      }
    ]
  }, [playerStats, players])

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col gap-6 px-4 py-6">
      <header className="rounded-[24px] border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-500">Analytics</p>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Sixteen club insights</h1>
      </header>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {analyticsCards.map((card) => (
          <article key={card.title} className="rounded-[24px] border border-zinc-200/70 bg-white/80 p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
            <h2 className="text-base font-semibold text-zinc-900 dark:text-zinc-100">{card.title}</h2>
            <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">{card.description}</p>
            {card.content}
          </article>
        ))}
      </section>
    </main>
  )
}
