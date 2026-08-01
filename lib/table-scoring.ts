import {
  basePointsForFan,
  DEFAULT_FAN_POINTS,
  DEFAULT_SCORING_RULES,
  type ScoringRules,
} from '@/lib/scoring-rules'

export const FAN_POINTS = DEFAULT_FAN_POINTS

export type TableWinType = 'self' | 'discard'

export function calculateTableScores(input: { players: string[]; winner: string; winType: TableWinType; loser?: string | null; fan: number; rules?: ScoringRules }) {
  const { players, winner, winType, loser, fan, rules = DEFAULT_SCORING_RULES } = input
  if (players.length !== 4 || !players.includes(winner) || (winType === 'discard' && (!loser || !players.includes(loser) || loser === winner))) return null
  const base = basePointsForFan(fan, rules)
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
