'use client'

import { useMemo } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { PlayerDoc, PlayerStatsDoc } from '@/lib/types'

type MiniChartEntry = { id: string; label: string; value: number }

function formatMiniValue(value: number, signed: boolean) {
  const rounded = Math.round(value * 10) / 10
  return signed && rounded > 0 ? `+${rounded}` : String(rounded)
}

function MiniBarChart({
  data,
  color = 'rgb(var(--bamboo))',
  signed = false,
  label,
}: {
  data: MiniChartEntry[]
  color?: string
  signed?: boolean
  label: string
}) {
  const max = Math.max(...data.map((entry) => Math.abs(entry.value)), 1)

  return (
    <div className="analytics-mini-chart mt-4 grid gap-3 rounded-lg border border-slate-200 bg-white p-3" role="list" aria-label={label}>
      {data.map((entry) => {
        const magnitude = Math.abs(entry.value) / max
        const width = signed ? Math.max(3, magnitude * 50) : Math.max(4, magnitude * 100)
        const barColor = signed
          ? entry.value < 0
            ? 'rgb(var(--cinnabar))'
            : 'rgb(var(--bamboo))'
          : color
        const valueLabel = formatMiniValue(entry.value, signed)

        return (
          <div
            key={entry.id}
            className="analytics-mini-row grid grid-cols-[minmax(64px,84px)_1fr_52px] items-center gap-2 sm:gap-3"
            role="listitem"
            aria-label={`${entry.label}: ${valueLabel}`}
          >
            <span className="truncate text-xs font-semibold text-slate-600" title={entry.label}>{entry.label}</span>
            <span className="relative block h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
              {signed ? <span className="absolute inset-y-0 left-1/2 w-px bg-slate-300" /> : null}
              <span
                className="absolute inset-y-0 rounded-full"
                style={signed
                  ? {
                      width: `${width}%`,
                      left: entry.value < 0 ? `${50 - width}%` : '50%',
                      backgroundColor: barColor,
                    }
                  : { width: `${width}%`, left: 0, backgroundColor: barColor }}
              />
            </span>
            <span className="text-right text-xs font-bold tabular-nums text-slate-700">{valueLabel}</span>
          </div>
        )
      })}
    </div>
  )
}

export default function AnalyticsPanel({
  playerStats,
  players,
  selectedPlayerIds,
}: {
  playerStats: PlayerStatsDoc[]
  players: PlayerDoc[]
  selectedPlayerIds?: string[]
}) {
  const playerNames = useMemo(
    () => new Map(players.map((player) => [player.id, player.displayName])),
    [players],
  )

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
    const name = playerNames.get(playerId) ?? playerId
    return short && name.length > 10 ? `${name.slice(0, 9)}…` : name
  }

  const cards = [
    {
      title: 'Rank Alignment',
      value: top.map((stat) => ({ id: stat.playerId, label: playerName(stat.playerId, true), value: Math.abs(stat.skillRank - stat.pointsRank) })),
      color: 'rgb(var(--bamboo))',
      signed: false,
      description: 'Lower is better. Compares experience-aware Skill rank to points rank.'
    },
    {
      title: 'Skill Headroom',
      value: top.map((stat) => ({ id: stat.playerId, label: playerName(stat.playerId, true), value: Math.max(0, stat.skillPeak - stat.skillRating) })),
      color: 'rgb(var(--gold))',
      signed: false,
      description: 'Distance from each player\'s peak rating.'
    },
    {
      title: 'Points / Game',
      value: top.map((stat) => ({ id: stat.playerId, label: playerName(stat.playerId, true), value: stat.gamesPlayed ? stat.totalPoints / stat.gamesPlayed : 0 })),
      color: 'rgb(var(--bamboo-bright))',
      signed: true,
      description: 'Average point result per recorded game.'
    },
    {
      title: 'Last 5 Skill',
      value: top.map((stat) => ({ id: stat.playerId, label: playerName(stat.playerId, true), value: stat.last5SkillDelta })),
      color: 'rgb(var(--cinnabar))',
      signed: true,
      description: 'Recent rating movement across the latest games.'
    }
  ]

  const pointsDistribution = useMemo(() => {
    return top
      .map((stat) => ({ id: stat.playerId, name: playerNames.get(stat.playerId) ?? stat.playerId, points: stat.totalPoints }))
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
  }, [playerNames, top])

  const pointsChartHeight = Math.max(280, pointsDistribution.length * 38 + 56)

  return (
    <section id="analytics" className="analytics-panel rounded-lg border border-slate-200 bg-white shadow-sm" aria-labelledby="analytics-heading">
      <header className="analytics-header border-b border-slate-200 px-4 py-4 sm:px-5">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Analytics</p>
        <h2 id="analytics-heading" className="mt-2 text-lg font-bold text-slate-900">Club insights</h2>
      </header>

      {top.length > 0 ? (
        <div className="analytics-content grid gap-4 p-3 sm:p-5">
          <figure className="analytics-points-chart min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:p-4">
            <figcaption>
              <h3 className="text-sm font-bold text-slate-800">Player points</h3>
              <p className="mt-1 text-xs font-medium leading-5 text-slate-500">Every selected player, ordered from highest to lowest cumulative points.</p>
            </figcaption>

            <div
              className="mt-4 max-h-[32rem] overflow-y-auto rounded-lg border border-slate-200 bg-white px-1 py-3 sm:px-2"
              role="img"
              aria-label="Horizontal bar chart of cumulative points by player"
            >
              <div style={{ height: pointsChartHeight, minWidth: 0 }} aria-hidden="true">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    accessibilityLayer
                    data={pointsDistribution}
                    layout="vertical"
                    margin={{ top: 6, right: 20, left: 4, bottom: 10 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="rgb(var(--line))" />
                    <XAxis type="number" tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }} />
                    <YAxis
                      type="category"
                      dataKey="name"
                      width={88}
                      tick={{ fontSize: 11, fill: 'rgb(var(--muted))' }}
                      tickFormatter={(name) => name.length > 13 ? `${name.slice(0, 12)}…` : name}
                    />
                    <ReferenceLine x={0} stroke="rgb(var(--muted))" />
                    <Tooltip
                      formatter={(value) => [Number(value).toLocaleString(), 'Points']}
                      cursor={{ fill: 'rgb(var(--bamboo) / .07)' }}
                      contentStyle={{
                        backgroundColor: 'rgb(var(--surface-1))',
                        border: '1px solid rgb(var(--line))',
                        borderRadius: 6,
                        color: 'rgb(var(--ink))',
                      }}
                      labelStyle={{ color: 'rgb(var(--ink))', fontWeight: 700 }}
                      itemStyle={{ color: 'rgb(var(--ink))' }}
                    />
                    <Bar dataKey="points" radius={3}>
                      {pointsDistribution.map((entry) => (
                        <Cell
                          key={entry.id}
                          fill={entry.points >= 0 ? 'rgb(var(--bamboo))' : 'rgb(var(--cinnabar))'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            <ul className="sr-only">
              {pointsDistribution.map((entry) => (
                <li key={entry.id}>{entry.name}: {entry.points.toLocaleString()} points</li>
              ))}
            </ul>
          </figure>

          <div className="analytics-summary-grid grid gap-4 md:grid-cols-2">
            {cards.map((card) => (
              <article key={card.title} className="analytics-summary-card rounded-lg border border-slate-200 bg-slate-50 p-4">
                <h3 className="text-sm font-bold text-slate-800">{card.title}</h3>
                <p className="mt-1 text-xs font-medium leading-5 text-slate-500">{card.description}</p>
                <MiniBarChart data={card.value} color={card.color} signed={card.signed} label={`${card.title} by player`} />
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="analytics-empty px-5 py-10 text-center text-sm font-medium text-slate-500">Record games to unlock analytics.</div>
      )}
    </section>
  )
}
