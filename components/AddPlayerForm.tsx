'use client'

import { useState } from 'react'

interface AddPlayerFormProps {
  existingPlayers: string[]
  onAdd: (name: string) => void
}

export default function AddPlayerForm({ existingPlayers, onAdd }: AddPlayerFormProps) {
  const [name, setName] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedName = name.trim()
    if (!trimmedName) {
      setError('Name cannot be empty')
      return
    }

    if (existingPlayers.some(p => p.toLowerCase() === trimmedName.toLowerCase())) {
      setError('Player already exists')
      return
    }

    setAdding(true)
    setError(null)

    try {
      const response = await fetch('/api/players', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmedName })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to add player')
      }

      setName('')
      onAdd(trimmedName)

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add player')
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="bg-card rounded-lg p-4 mb-6">
      <h3 className="text-lg font-bold text-text mb-3">Add New Player</h3>

      <form onSubmit={handleSubmit} className="flex space-x-3">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Player name"
          className="flex-1 bg-gray-700 text-text border border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-500"
          disabled={adding}
        />
        <button
          type="submit"
          disabled={adding || !name.trim()}
          className="bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {adding ? 'Adding...' : 'Add Player'}
        </button>
      </form>

      {error && (
        <div className="mt-2 text-red-400 text-sm">
          {error}
        </div>
      )}
    </div>
  )
}