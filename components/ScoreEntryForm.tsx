'use client'

import { useState, useEffect } from 'react'
import { validateRound } from '@/lib/scoring'
import { GameRound } from '@/lib/types'

interface ScoreEntryFormProps {
  players: string[]
  onSubmit: (round: GameRound) => void
}

export default function ScoreEntryForm({ players, onSubmit }: ScoreEntryFormProps) {
  const [scores, setScores] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Initialize scores when players change
  useEffect(() => {
    const initialScores: Record<string, number> = {}
    players.forEach(player => {
      initialScores[player] = 0
    })
    setScores(initialScores)
  }, [players])

  const updateScore = (player: string, value: number) => {
    setScores(prev => ({ ...prev, [player]: value }))
  }

  const adjustScore = (player: string, delta: number) => {
    setScores(prev => ({ ...prev, [player]: (prev[player] || 0) + delta }))
  }

  const clearAll = () => {
    const cleared: Record<string, number> = {}
    players.forEach(player => {
      cleared[player] = 0
    })
    setScores(cleared)
  }

  const handleSubmit = async () => {
    const validation = validateRound(scores)
    if (!validation.valid) {
      setError(validation.message)
      return
    }

    setSubmitting(true)
    setError(null)

    try {
      const round: GameRound = {
        datetime: new Date().toISOString(),
        scores
      }

      const response = await fetch('/api/scores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scores })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to save')
      }

      // Success
      clearAll()
      onSubmit(round)

      // Show success toast
      setError(null)
      // In a real app, you'd use a toast library here

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save round')
    } finally {
      setSubmitting(false)
    }
  }

  const validation = validateRound(scores)
  const canSubmit = validation.valid && !submitting

  // Calculate grid columns based on player count
  const getGridCols = () => {
    if (players.length <= 4) return 'grid-cols-1 sm:grid-cols-2'
    if (players.length <= 8) return 'grid-cols-1 sm:grid-cols-2'
    if (players.length <= 14) return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
    return 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4'
  }

  return (
    <div className="bg-card rounded-lg p-4 mb-6">
      <h2 className="text-xl font-bold text-text mb-4">Enter Scores</h2>

      <div className={`grid ${getGridCols()} gap-4 mb-4`}>
        {players.map((player) => (
          <div key={player} className="bg-gray-800 rounded-lg p-3">
            <div className="text-center mb-2">
              <div className="font-medium text-text text-sm">{player}</div>
            </div>
            <div className="flex items-center justify-center space-x-2">
              <button
                onClick={() => adjustScore(player, -1)}
                className="w-8 h-8 bg-red-600 hover:bg-red-700 text-white rounded flex items-center justify-center text-lg font-bold"
                disabled={submitting}
              >
                -
              </button>
              <input
                type="number"
                inputMode="numeric"
                value={scores[player] || 0}
                onChange={(e) => updateScore(player, parseInt(e.target.value) || 0)}
                className="w-16 text-center bg-gray-700 text-text border border-gray-600 rounded px-2 py-1"
                disabled={submitting}
              />
              <button
                onClick={() => adjustScore(player, 1)}
                className="w-8 h-8 bg-green-600 hover:bg-green-700 text-white rounded flex items-center justify-center text-lg font-bold"
                disabled={submitting}
              >
                +
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-4">
        <div className={`text-center py-2 px-4 rounded ${
          validation.valid
            ? 'bg-green-900/20 text-green-400 border border-green-700'
            : 'bg-red-900/20 text-red-400 border border-red-700'
        }`}>
          {validation.message}
        </div>
      </div>

      {error && (
        <div className="mb-4 text-center py-2 px-4 bg-red-900/20 text-red-400 border border-red-700 rounded">
          {error}
        </div>
      )}

      <div className="flex space-x-3">
        <button
          onClick={clearAll}
          disabled={submitting}
          className="flex-1 bg-gray-600 hover:bg-gray-700 disabled:bg-gray-800 text-text py-3 px-4 rounded-lg font-medium transition-colors"
        >
          Clear All
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 text-white py-3 px-4 rounded-lg font-medium transition-colors"
        >
          {submitting ? 'Saving...' : 'Submit Scores'}
        </button>
      </div>
    </div>
  )
}