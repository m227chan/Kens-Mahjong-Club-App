// 14 distinct colors — assigned by index, never by name
export const PLAYER_COLORS = [
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#EC4899', // pink
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#EF4444', // red
  '#A78BFA', // purple
  '#34D399', // teal
  '#FCD34D', // yellow
  '#FB7185', // rose
  '#94A3B8', // slate
]

// Colors cycle if player count exceeds palette length
export function assignPlayerColors(
  playerNames: string[]
): Record<string, string> {
  return Object.fromEntries(
    playerNames.map((name, i) => [
      name,
      PLAYER_COLORS[i % PLAYER_COLORS.length]
    ])
  )
}

// Dynamic title assignment based on total player count N
// N=4: Messiah, Master, Mongrel, Moron
// N=5: Messiah, Master, Monk, Mongrel, Moron
// N=6: Messiah, Master, Monk, Minion, Mongrel, Moron
// N=7+: Messiah, Master, [N-5 Monks], Minion, Mongrel, Moron
export function assignTitles(
  rankedPlayers: { name: string; rank: number; roundsPlayed: number }[],
  totalPlayers: number
): Record<string, { title: string; emoji: string }> {
  const result: Record<string, { title: string; emoji: string }> = {}

  for (const player of rankedPlayers) {
    const { name, rank, roundsPlayed } = player

    // New player (roundsPlayed === 0) → always Monk regardless of rank
    if (roundsPlayed === 0) {
      result[name] = { title: 'Monk', emoji: '🧘' }
      continue
    }

    // effectiveRank 1 → Messiah 👑
    if (rank === 1) {
      result[name] = { title: 'Messiah', emoji: '👑' }
    }
    // effectiveRank 2 → Master 🏆
    else if (rank === 2) {
      result[name] = { title: 'Master', emoji: '🏆' }
    }
    // effectiveRank totalPlayers → Moron 🤡
    else if (rank === totalPlayers) {
      result[name] = { title: 'Moron', emoji: '🤡' }
    }
    // effectiveRank totalPlayers-1 → Mongrel 🐶
    else if (rank === totalPlayers - 1) {
      result[name] = { title: 'Mongrel', emoji: '🐶' }
    }
    // effectiveRank totalPlayers-2 AND N>=6 → Minion 🪄
    else if (rank === totalPlayers - 2 && totalPlayers >= 6) {
      result[name] = { title: 'Minion', emoji: '🪄' }
    }
    // all others → Monk 🧘
    else {
      result[name] = { title: 'Monk', emoji: '🧘' }
    }
  }

  return result
}