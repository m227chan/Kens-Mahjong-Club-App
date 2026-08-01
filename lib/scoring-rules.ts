export interface ScoringRules {
  minFan: number
  maxFan: number
  fanPoints: Record<number, number>
}

export const DEFAULT_FAN_POINTS: Record<number, number> = {
  3: 8,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
  9: 96,
  10: 128,
  11: 192,
  12: 256,
  13: 384,
}

export const DEFAULT_SCORING_RULES: ScoringRules = {
  minFan: 3,
  maxFan: 13,
  fanPoints: DEFAULT_FAN_POINTS,
}

export const MIN_ALLOWED_FAN = 1
export const MAX_ALLOWED_FAN = 30
export const MAX_BASE_POINTS = 333_333

export function fanValues(rules: ScoringRules) {
  return Array.from(
    { length: rules.maxFan - rules.minFan + 1 },
    (_, index) => rules.minFan + index,
  )
}

export function fanLabel(fan: number, rules: ScoringRules) {
  return fan === rules.maxFan ? `${fan}+` : String(fan)
}

export function basePointsForFan(fan: number, rules: ScoringRules) {
  if (!Number.isInteger(fan) || fan < rules.minFan) return null
  const cappedFan = Math.min(fan, rules.maxFan)
  return rules.fanPoints[cappedFan] ?? null
}

export function suggestedBasePoints(fan: number) {
  if (DEFAULT_FAN_POINTS[fan]) return DEFAULT_FAN_POINTS[fan]
  if (fan < 3) return Math.max(1, Math.round(8 / 2 ** (3 - fan)))
  return DEFAULT_FAN_POINTS[13]
}

export function validateScoringRules(value: unknown): ScoringRules {
  if (!value || typeof value !== 'object')
    throw new Error('Scoring rules are required.')
  const input = value as Record<string, unknown>
  const minFan = Number(input.minFan)
  const maxFan = Number(input.maxFan)
  if (
    !Number.isInteger(minFan) ||
    !Number.isInteger(maxFan) ||
    minFan < MIN_ALLOWED_FAN ||
    maxFan > MAX_ALLOWED_FAN ||
    minFan > maxFan
  )
    throw new Error(
      `Fan range must be whole numbers from ${MIN_ALLOWED_FAN} to ${MAX_ALLOWED_FAN}.`,
    )

  const source = input.fanPoints
  if (!source || typeof source !== 'object' || Array.isArray(source))
    throw new Error('Enter a base-point value for every fan level.')
  const fanPoints: Record<number, number> = {}
  for (let fan = minFan; fan <= maxFan; fan += 1) {
    const points = Number((source as Record<string, unknown>)[String(fan)])
    if (
      !Number.isSafeInteger(points) ||
      points < 1 ||
      points > MAX_BASE_POINTS
    )
      throw new Error(
        `Base points for ${fanLabel(fan, { minFan, maxFan, fanPoints })} fan must be a whole number from 1 to ${MAX_BASE_POINTS.toLocaleString()}.`,
      )
    fanPoints[fan] = points
  }
  return { minFan, maxFan, fanPoints }
}

export function scoringRulesFromRow(row: Record<string, unknown> | null | undefined) {
  if (!row) return DEFAULT_SCORING_RULES
  try {
    return validateScoringRules({
      minFan: row.scoring_min_fan,
      maxFan: row.scoring_max_fan,
      fanPoints: row.fan_points,
    })
  } catch {
    return DEFAULT_SCORING_RULES
  }
}
