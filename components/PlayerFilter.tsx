'use client'

import { useState } from 'react'

interface PlayerFilterProps {
  players: string[]
  colorMap: Record<string, string>
  activePlayers: string[]
  onChange: (active: string[]) => void
}

export default function PlayerFilter({
  players,
  colorMap,
  activePlayers,
  onChange
}: PlayerFilterProps) {
  const handleToggle = (player: string) => {
    if (activePlayers.includes(player)) {
      onChange(activePlayers.filter(p => p !== player))
    } else {
      onChange([...activePlayers, player])
    }
  }

  const handleAll = () => onChange([...players])
  const handleNone = () => onChange([])

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-text">Filter Players</h3>
        <div className="flex space-x-2">
          <button
            onClick={handleAll}
            className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded transition-colors"
          >
            All
          </button>
          <button
            onClick={handleNone}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-700 text-white text-sm rounded transition-colors"
          >
            None
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 overflow-x-auto pb-2">
        {players.map(player => {
          const isActive = activePlayers.includes(player)
          return (
            <button
              key={player}
              onClick={() => handleToggle(player)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap min-h-[36px] ${
                isActive
                  ? 'text-white shadow-lg transform scale-105'
                  : 'text-gray-400 bg-gray-700 hover:bg-gray-600'
              }`}
              style={{
                backgroundColor: isActive ? colorMap[player] : undefined
              }}
            >
              {player}
            </button>
          )
        })}
      </div>
    </div>
  )
}