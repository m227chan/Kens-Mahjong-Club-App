import { ordinal, rate, rating, type Rating } from 'openskill'

export const SKILL_PROVISIONAL_GAMES = 20
const SKILL_SCALE = 20
const SKILL_START = 1500

type SkillState = { mu: number; sigma: number; gamesPlayed: number }
type SkillEntry = SkillState & { playerId: string; score: number }
type SkillResult = SkillState & { playerId: string; ratingBefore: number; ratingAfter: number; delta: number }

export function initialSkillState(): SkillState {
  const value = rating()
  return { mu: value.mu, sigma: value.sigma, gamesPlayed: 0 }
}

export function displayedSkill(value: Pick<SkillState, 'mu' | 'sigma'>) {
  return Math.round(SKILL_START + ordinal(value as Rating) * SKILL_SCALE)
}

export function calculateSkillRound(entries: SkillEntry[]): SkillResult[] {
  if (entries.length < 2) return entries.map((entry) => ({ ...entry, ratingBefore: displayedSkill(entry), ratingAfter: displayedSkill(entry), delta: 0 }))
  const teams = entries.map((entry) => [{ mu: entry.mu, sigma: entry.sigma }])
  const rated = rate(teams, { score: entries.map((entry) => Math.sign(entry.score)) })
  const containsProvisional = entries.some((entry) => entry.gamesPlayed < SKILL_PROVISIONAL_GAMES)

  return entries.map((entry, index) => {
    const raw = rated[index][0]
    const opponentConfidence = entries.reduce((sum, opponent, opponentIndex) => {
      if (opponentIndex === index) return sum
      return sum + Math.max(0.1, Math.min(1, opponent.gamesPlayed / SKILL_PROVISIONAL_GAMES))
    }, 0) / Math.max(1, entries.length - 1)
    const mu = entry.gamesPlayed >= SKILL_PROVISIONAL_GAMES && containsProvisional
      ? entry.mu + (raw.mu - entry.mu) * opponentConfidence
      : raw.mu
    const next = { mu, sigma: raw.sigma, gamesPlayed: entry.gamesPlayed + 1 }
    const ratingBefore = displayedSkill(entry)
    const ratingAfter = displayedSkill(next)
    return { playerId: entry.playerId, ...next, ratingBefore, ratingAfter, delta: ratingAfter - ratingBefore }
  })
}
