interface GameRound {
  datetime: string
  scores: Record<string, number>
}

interface LeaderboardEntry {
  name: string
  color: string
  title: string
  titleEmoji: string
  rank: number
  isTied: boolean
  totalScore: number
  roundsPlayed: number
  displayRank: string
}

export const FAN_TO_POINTS: Record<number, number> = {
  0: 1, 1: 2, 2: 4, 3: 8, 4: 16,
  5: 24, 6: 32, 7: 48, 8: 64, 9: 96, 10: 128
}

// Running cumulative score per player across all rounds
export function calculateCumulativeScores(
  rounds: GameRound[],
  players: string[]
): Record<string, number[]> {
  const cumulative: Record<string, number[]> = {}
  const runningTotals: Record<string, number> = {}

  // Initialize
  players.forEach(player => {
    cumulative[player] = []
    runningTotals[player] = 0
  })

  // Calculate running totals
  rounds.forEach(round => {
    players.forEach(player => {
      const score = round.scores[player] || 0
      runningTotals[player] += score
      cumulative[player].push(runningTotals[player])
    })
  })

  return cumulative
}

// Sort and rank players, handle ties
export function calculateRankings(
  players: string[],
  cumulativeScores: Record<string, number>,
  roundsPlayedMap: Record<string, number>
): LeaderboardEntry[] {
  // Create entries with current cumulative scores
  const entries = players.map(player => ({
    name: player,
    totalScore: cumulativeScores[player] || 0,
    roundsPlayed: roundsPlayedMap[player] || 0
  }))

  // Sort by score descending (highest first)
  entries.sort((a, b) => b.totalScore - a.totalScore)

  // Assign ranks, handling ties
  const rankings: LeaderboardEntry[] = []
  let currentRank = 1
  let previousScore = entries[0]?.totalScore

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const isTied = entry.totalScore === previousScore && i > 0

    if (!isTied) {
      currentRank = i + 1
    }

    rankings.push({
      name: entry.name,
      color: '', // Will be assigned later
      title: '', // Will be assigned later
      titleEmoji: '', // Will be assigned later
      rank: currentRank,
      isTied,
      totalScore: entry.totalScore,
      roundsPlayed: entry.roundsPlayed,
      displayRank: isTied ? `=${currentRank}` : currentRank.toString()
    })

    previousScore = entry.totalScore
  }

  return rankings
}

// Validate a round before submission
export function validateRound(
  scores: Record<string, number>
): { valid: boolean; sum: number; message: string } {
  const values = Object.values(scores)
  const sum = values.reduce((acc, val) => acc + val, 0)

  if (sum === 0) {
    return { valid: true, sum, message: 'Scores sum to 0 ✓' }
  } else {
    return {
      valid: false,
      sum,
      message: `Scores sum to ${sum} — must equal 0`
    }
  }
}

// Calculate scores from fan count
export function calculateRoundFromFan(
  fan: number,
  winType: 'self-draw' | 'discard',
  winnerName: string,
  players: string[],
  discarderName?: string
): Record<string, number> {
  const points = FAN_TO_POINTS[fan] || 0
  const scores: Record<string, number> = {}

  // Initialize all players to 0
  players.forEach(player => {
    scores[player] = 0
  })

  if (winType === 'self-draw') {
    // Winner gets points * 3, others lose points
    scores[winnerName] = points * 3
    players.forEach(player => {
      if (player !== winnerName) {
        scores[player] = -points
      }
    })
  } else if (winType === 'discard' && discarderName) {
    // Winner gets points * 2, discarder loses points * 2, others unchanged
    scores[winnerName] = points * 2
    scores[discarderName] = -points * 2
  }

  return scores
}