import { LeaderboardEntry } from '@/lib/types'

interface LeaderboardRowProps {
  entry: LeaderboardEntry
  colorMap: Record<string, string>
}

export default function LeaderboardRow({ entry, colorMap }: LeaderboardRowProps) {
  const bgColor = colorMap[entry.name] || '#94A3B8'
  const textColorClass = entry.totalScore >= 0 ? 'text-green-600' : 'text-red-600'

  return (
    <div className="flex items-center justify-between p-4 border-b border-gray-700 hover:bg-gray-800/50 transition-colors">
      <div className="flex items-center space-x-3">
        <div className="text-lg font-bold text-gray-300 min-w-[3rem]">
          {entry.displayRank}
        </div>
        <div
          className="px-2 py-1 rounded text-sm font-medium text-white flex items-center space-x-1"
          style={{ backgroundColor: bgColor }}
        >
          <span>{entry.titleEmoji}</span>
          <span>{entry.title}</span>
        </div>
        <div className="font-medium text-text">
          {entry.name}
        </div>
      </div>
      <div className={`font-bold text-lg ${textColorClass}`}>
        {entry.totalScore > 0 ? '+' : ''}{entry.totalScore}
      </div>
    </div>
  )
}