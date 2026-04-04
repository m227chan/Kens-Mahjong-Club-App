import { GameRound } from '@/lib/types'

interface ScoreLogProps {
  rounds: GameRound[]
  players: string[]
  colorMap: Record<string, string>
}

export default function ScoreLog({ rounds, players, colorMap }: ScoreLogProps) {
  // Sort rounds by datetime descending (most recent first)
  const sortedRounds = [...rounds].sort((a, b) =>
    new Date(b.datetime).getTime() - new Date(a.datetime).getTime()
  )

  return (
    <div className="bg-card rounded-lg p-4">
      <h2 className="text-xl font-bold text-text mb-4">Score History</h2>

      {sortedRounds.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          No rounds played yet
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-600">
                <th className="text-left py-2 text-text font-medium">Date/Time</th>
                {players.map(player => (
                  <th
                    key={player}
                    className="text-left py-2 px-2 font-medium"
                    style={{ color: colorMap[player] || '#94A3B8' }}
                  >
                    {player}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRounds.map((round, index) => (
                <tr key={index} className="border-b border-gray-700">
                  <td className="py-2 text-gray-400">
                    {new Date(round.datetime).toLocaleString()}
                  </td>
                  {players.map(player => {
                    const score = round.scores[player] || 0
                    const colorClass = score > 0 ? 'text-green-400' : score < 0 ? 'text-red-400' : 'text-gray-500'
                    return (
                      <td key={player} className={`py-2 px-2 font-medium ${colorClass}`}>
                        {score > 0 ? '+' : ''}{score}
                      </td>
                    )
                  })}
                </tr>
              ))}

              {/* Totals row */}
              <tr className="border-t-2 border-gray-500 bg-gray-800/50">
                <td className="py-3 font-bold text-text">TOTALS</td>
                {players.map(player => {
                  const total = sortedRounds.reduce((sum, round) => sum + (round.scores[player] || 0), 0)
                  const colorClass = total > 0 ? 'text-green-400' : total < 0 ? 'text-red-400' : 'text-gray-500'
                  return (
                    <td key={player} className={`py-3 px-2 font-bold ${colorClass}`}>
                      {total > 0 ? '+' : ''}{total}
                    </td>
                  )
                })}
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}