'use client'

import { useState } from 'react'
import { FAN_TO_POINTS } from '@/lib/scoring'

export default function FanCalculator() {
  const [isOpen, setIsOpen] = useState(false)

  const fanRows = [
    { fan: 0, points: 1, note: '' },
    { fan: 1, points: 2, note: '' },
    { fan: 2, points: 4, note: '' },
    { fan: 3, points: 8, note: '← minimum recommended' },
    { fan: 4, points: 16, note: '' },
    { fan: 5, points: 24, note: '' },
    { fan: 6, points: 32, note: '' },
    { fan: 7, points: 48, note: '' },
    { fan: 8, points: 64, note: '' },
    { fan: 9, points: 96, note: '' },
    { fan: 10, points: 128, note: 'Limit' },
  ]

  return (
    <div className="mb-6">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-card border border-gray-600 rounded-lg p-3 text-left hover:bg-gray-700 transition-colors"
      >
        <div className="flex items-center justify-between">
          <span className="font-medium text-text">🀄 Fan → Points Reference</span>
          <span className={`transform transition-transform ${isOpen ? 'rotate-180' : ''}`}>
            ▼
          </span>
        </div>
      </button>

      {isOpen && (
        <div className="mt-2 bg-card border border-gray-600 rounded-lg p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="text-left py-2 text-text">Fan</th>
                <th className="text-left py-2 text-text">Points</th>
                <th className="text-left py-2 text-text">Note</th>
              </tr>
            </thead>
            <tbody>
              {fanRows.map((row) => (
                <tr
                  key={row.fan}
                  className={`border-b border-gray-700 ${
                    row.fan >= 3 && row.fan <= 10 ? 'bg-green-900/20' : ''
                  }`}
                >
                  <td className="py-2 text-text">{row.fan}</td>
                  <td className="py-2 text-text">{row.points}</td>
                  <td className="py-2 text-gray-400">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-300">
            <div>
              <h4 className="font-medium text-text mb-2">Self Draw</h4>
              <p>All other players pay hand value</p>
            </div>
            <div>
              <h4 className="font-medium text-text mb-2">Win by Discard</h4>
              <p>Discarder pays 2× hand value only</p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}