'use client'

import { useState, useEffect } from 'react'
import { AppData, LeaderboardEntry } from '@/lib/types'
import { calculateRankings, calculateCumulativeScores } from '@/lib/scoring'
import { assignPlayerColors, assignTitles } from '@/lib/players'
import LeaderboardRow from './LeaderboardRow'
import OfflineBanner from './OfflineBanner'

export default function Leaderboard() {
  const [data, setData] = useState<AppData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = async () => {
    try {
      const response = await fetch('/api/scores')
      if (!response.ok) throw new Error('Failed to fetch data')
      const newData: AppData = await response.json()
      setData(newData)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()

    // Poll every 30 seconds
    const interval = setInterval(fetchData, 30000)
    return () => clearInterval(interval)
  }, [])

  if (loading) {
    return (
      <div className="p-4">
        <div className="text-center py-8">
          <div className="animate-pulse space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-16 bg-gray-700 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="p-4">
        <div className="text-center py-8 text-red-400">
          Failed to load leaderboard: {error}
        </div>
      </div>
    )
  }

  // Calculate rankings
  const cumulativeScores = calculateCumulativeScores(data.rounds, data.players)
  const rankings = calculateRankings(data.players, cumulativeScores, {})

  // Assign colors and titles
  const colorMap = assignPlayerColors(data.players)
  const titleMap = assignTitles(
    rankings.map(r => ({
      name: r.name,
      rank: r.rank,
      roundsPlayed: r.roundsPlayed
    })),
    data.players.length
  )

  // Apply titles and colors to rankings
  const finalRankings: LeaderboardEntry[] = rankings.map(entry => ({
    ...entry,
    color: colorMap[entry.name] || '#94A3B8',
    title: titleMap[entry.name]?.title || 'Monk',
    titleEmoji: titleMap[entry.name]?.emoji || '🧘'
  }))

  return (
    <div className="min-h-screen">
      <OfflineBanner isOffline={data.isOffline} />

      <div className="p-4">
        <h1 className="text-2xl font-bold text-text mb-6 text-center">
          Leaderboard
        </h1>

        <div className="space-y-0">
          {finalRankings.map((entry, index) => (
            <div
              key={entry.name}
              className="animate-in slide-in-from-left duration-300"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <LeaderboardRow entry={entry} colorMap={colorMap} />
            </div>
          ))}
        </div>

        {data.lastUpdated && (
          <div className="text-center text-xs text-gray-500 mt-4">
            Last updated: {new Date(data.lastUpdated).toLocaleString()}
          </div>
        )}
      </div>
    </div>
  )
}