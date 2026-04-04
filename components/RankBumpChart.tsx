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

interface RankBumpChartProps {
  rounds: GameRound[]
  players: string[]
  colorMap: Record<string, string>
  activePlayers: string[]
}

export default function RankBumpChart({
  rounds,
  players,
  colorMap,
  activePlayers
}: RankBumpChartProps) {
  const [highlightedPlayer, setHighlightedPlayer] = React.useState<string | null>(null)

  // Calculate rank data for each round
  const rankData = rounds.map((round, roundIndex) => {
    // Calculate scores for this round
    const roundScores: Record<string, number> = {}
    activePlayers.forEach(player => {
      roundScores[player] = round.scores[player] || 0
    })

    // Sort players by score for ranking
    const sortedPlayers = [...activePlayers].sort((a, b) => roundScores[b] - roundScores[a])

    // Create rank mapping
    const playerRanks: Record<string, number> = {}
    sortedPlayers.forEach((player, index) => {
      playerRanks[player] = index + 1
    })

    return {
      round: roundIndex + 1,
      datetime: round.datetime,
      ...playerRanks
    }
  })

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload

      return (
        <div className="bg-gray-800 border border-gray-600 rounded-lg p-3 shadow-lg">
          <div className="text-text font-medium mb-2">
            Round {label}
          </div>
          <div className="text-gray-400 text-sm mb-2">
            {new Date(data.datetime).toLocaleString()}
          </div>
          <div className="space-y-1">
            {activePlayers
              .filter(player => data[player] !== undefined)
              .sort((a, b) => data[a] - data[b])
              .map(player => (
              <div key={player} className="flex items-center justify-between space-x-3">
                <div className="flex items-center space-x-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: colorMap[player] }}
                  />
                  <span className="text-text text-sm">{player}</span>
                </div>
                <span className="text-text text-sm font-medium">
                  Rank {data[player]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )
    }
    return null
  }

  if (rankData.length === 0) {
    return (
      <div className="bg-card rounded-lg p-6 text-center">
        <div className="text-gray-500">No rounds played yet</div>
      </div>
    )
  }

  return (
    <div className="bg-card rounded-lg p-4">
      <h3 className="text-lg font-bold text-text mb-4">Rank Changes</h3>

      <ResponsiveContainer width="100%" height={350}>
        <LineChart
          data={rankData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
          <XAxis
            dataKey="round"
            stroke="#94A3B8"
            label={{ value: 'Round', position: 'insideBottom', offset: -5, style: { textAnchor: 'middle', fill: '#94A3B8' } }}
          />
          <YAxis
            reversed
            domain={[1, activePlayers.length]}
            stroke="#94A3B8"
            label={{ value: 'Rank', angle: -90, position: 'insideLeft', style: { textAnchor: 'middle', fill: '#94A3B8' } }}
            ticks={Array.from({ length: activePlayers.length }, (_, i) => i + 1)}
          />
          <Tooltip content={<CustomTooltip />} />

          {activePlayers.map(player => (
            <Line
              key={player}
              type="monotone"
              dataKey={player}
              stroke={colorMap[player]}
              strokeWidth={highlightedPlayer === player ? 3 : 2}
              dot={{ r: 4 }}
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