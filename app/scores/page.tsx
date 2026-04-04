'use client'

import { useState, useEffect } from 'react'
import { AppData, GameRound } from '@/lib/types'
import { assignPlayerColors } from '@/lib/players'
import FanCalculator from '@/components/FanCalculator'
import ScoreEntryForm from '@/components/ScoreEntryForm'
import AddPlayerForm from '@/components/AddPlayerForm'
import ScoreLog from '@/components/ScoreLog'

export default function ScoresPage() {
  const [data, setData] = useState<AppData | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    try {
      const response = await fetch('/api/scores')
      if (!response.ok) throw new Error('Failed to fetch data')
      const newData: AppData = await response.json()
      setData(newData)
    } catch (err) {
      console.error('Failed to fetch data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleRoundSubmit = (round: GameRound) => {
    // Refresh data after successful submission
    fetchData()
  }

  const handlePlayerAdd = (name: string) => {
    // Refresh data after adding player
    fetchData()
  }

  if (loading || !data) {
    return (
      <div className="min-h-screen p-4">
        <div className="text-center py-8">
          <div className="animate-pulse text-text">Loading...</div>
        </div>
      </div>
    )
  }

  const colorMap = assignPlayerColors(data.players)

  return (
    <div className="min-h-screen p-4 pb-20">
      <h1 className="text-2xl font-bold text-text mb-6 text-center">
        Score Entry
      </h1>

      <FanCalculator />

      <ScoreEntryForm
        players={data.players}
        onSubmit={handleRoundSubmit}
      />

      <AddPlayerForm
        existingPlayers={data.players}
        onAdd={handlePlayerAdd}
      />

      <ScoreLog
        rounds={data.rounds}
        players={data.players}
        colorMap={colorMap}
      />
    </div>
  )
}