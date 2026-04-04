'use client'

import { useState, useEffect } from 'react'
import { AppData } from '@/lib/types'
import { assignPlayerColors } from '@/lib/players'
import OfflineBanner from '@/components/OfflineBanner'
import PlayerFilter from '@/components/PlayerFilter'
import CumulativeScoreChart from '@/components/CumulativeScoreChart'
import RankBumpChart from '@/components/RankBumpChart'

export default function DashboardPage() {
  const [data, setData] = useState<AppData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activePlayers, setActivePlayers] = useState<string[]>([])

  const fetchData = async () => {
    try {
      const response = await fetch('/api/scores')
      if (!response.ok) throw new Error('Failed to fetch data')
      const newData: AppData = await response.json()
      setData(newData)

      // Initialize active players to all players if not set
      if (activePlayers.length === 0 && newData.players.length > 0) {
        setActivePlayers(newData.players)
      }
    } catch (err) {
      console.error('Failed to fetch data:', err)
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

  if (loading || !data) {
    return (
      <div className="min-h-screen p-4">
        <div className="text-center py-8">
          <div className="animate-pulse text-text">Loading dashboard...</div>
        </div>
      </div>
    )
  }

  const colorMap = assignPlayerColors(data.players)

  return (
    <div className="min-h-screen p-4 pb-20">
      <OfflineBanner isOffline={data.isOffline} />

      <h1 className="text-2xl font-bold text-text mb-6 text-center">
        Dashboard
      </h1>

      <PlayerFilter
        players={data.players}
        colorMap={colorMap}
        activePlayers={activePlayers}
        onChange={setActivePlayers}
      />

      <div className="space-y-6">
        <CumulativeScoreChart
          rounds={data.rounds}
          players={data.players}
          colorMap={colorMap}
          activePlayers={activePlayers}
        />

        <RankBumpChart
          rounds={data.rounds}
          players={data.players}
          colorMap={colorMap}
          activePlayers={activePlayers}
        />
      </div>
    </div>
  )
}