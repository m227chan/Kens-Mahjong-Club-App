export const FAN_POINTS: Record<number, number> = {
  3: 8, 4: 16, 5: 24, 6: 32, 7: 48, 8: 64,
  9: 96, 10: 128, 11: 192, 12: 256, 13: 384
}

export type TableWinType = 'self' | 'discard'

export function calculateTableScores(input: { players: string[]; winner: string; winType: TableWinType; loser?: string | null; fan: number }) {
  const { players, winner, winType, loser, fan } = input
  if (players.length !== 4 || !players.includes(winner) || (winType === 'discard' && (!loser || !players.includes(loser) || loser === winner))) return null
  const base = fan >= 13 ? 384 : FAN_POINTS[fan]
  if (!base) return null
  const scores: Record<string, number> = {}
  const nonWinners = players.filter((playerId) => playerId !== winner)
  if (winType === 'self') {
    scores[winner] = base * 3
    nonWinners.forEach((playerId) => { scores[playerId] = -base })
  } else {
    scores[winner] = base * 2
    scores[loser!] = -base * 2
    nonWinners.filter((playerId) => playerId !== loser).forEach((playerId) => { scores[playerId] = 0 })
  }
  return scores
}
