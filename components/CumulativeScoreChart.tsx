'use client'

import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'
import { GameRound } from '@/lib/types'
import { calculateCumulativeScores } from '@/lib/scoring'

interface CumulativeScoreChartProps {
  rounds: GameRound[]
  players: string[]
  colorMap: Record<string, string>
  activePlayers: string[]
}

export default function CumulativeScoreChart({
  rounds,
  players,
  colorMap,
  activePlayers
}: CumulativeScoreChartProps) {
  const [highlightedPlayer, setHighlightedPlayer] = React.useState<string | null>(null)

  // Calculate cumulative scores
  const cumulativeData = calculateCumulativeScores(rounds, players)

  // Prepare chart data
  const chartData = rounds.map((round, index) => {
    const dataPoint: any = {
      round: index + 1,
      datetime: round.datetime
    }

    activePlayers.forEach(player => {
      dataPoint[player] = cumulativeData[player][index]
    })

    return dataPoint
  })

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const sortedPlayers = [...activePlayers].sort((a, b) => (data[b] || 0) - (data[a] || 0))

      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <div className="text-text font-medium mb-2">
            Round {label}
          </div>
          <div className="text-gray-400 text-sm mb-2">
            {new Date(data.datetime).toLocaleString()}
          </div>
          <div className="space-y-1">
            {sortedPlayers.map(player => (
              <div key={player} className="flex items-center justify-between space-x-3">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colorMap[player] }}
                  />
                  <span className="text-text text-sm">{player}</span>
                </div>
                <span className={`text-sm font-medium ${
                  (data[player] || 0) >= 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {(data[player] || 0) > 0 ? '+' : ''}{data[player] || 0}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return null
  }

  if (chartData.length === 0) {
    return (
      <div className="bg-card rounded-lg p-6 text-center">
        <div className="text-gray-500">No rounds played yet</div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg p-4">
      <h3 className="text-lg font-bold text-text mb-4">Cumulative Scores</h3>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="round"
            stroke="#94A3B8"
            label={{ value: 'Round', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fill: '#94A3B8' } }}
          />
          <YAxis
            stroke="#94A3B8"
            label={{ value: 'Score', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#94A3B8' } }}
          />
          <Tooltip content={<CustomTooltip />} />

          {activePlayers.map(player => (
            <Line
              key={player}
              type="monotone"
              dataKey={player}
              stroke={colorMap[player]}
              strokeWidth={highlightedPlayer === player ? 3 : 2}
              dot={{ r: highlightedPlayer === player ? 4 : 2 }}
              activeDot={{ r: 6 }}
              opacity={highlightedPlayer && highlightedPlayer !== player ? 0.2 : 1}
              onMouseEnter={() => setHighlightedPlayer(player)}
              onMouseLeave={() => setHighlightedPlayer(null)}
              animationDuration={1500}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}