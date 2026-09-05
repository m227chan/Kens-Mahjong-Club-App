import type { ScoringRules } from '@/lib/scoring-rules'
import { applyExclusions } from './apply-exclusions'
import { detectPatterns } from './detect-patterns'
import { fanToNumber } from './parse-fan'
import {
  LIMIT_PATTERN_IDS,
  SCORING_PATTERN_MAP,
  patternsForCalculator,
} from './patterns'
import { enrichMatchedPatternTitles } from './pattern-labels'
import type { FanCalculationResult, HandScoringInput, MatchedPattern } from './types'

export function calculateFan(
  input: HandScoringInput,
  rules: ScoringRules,
): FanCalculationResult {
  const allowedPatterns = patternsForCalculator(input.includeNonTraditional)
  const allowedIds = new Set(allowedPatterns.map((p) => p.id))
  const detected = detectPatterns(input).filter((id) => allowedIds.has(id))
  const afterExclusions = applyExclusions(detected, SCORING_PATTERN_MAP)

  const patterns: MatchedPattern[] = enrichMatchedPatternTitles(
    input,
    afterExclusions
      .map((id) => {
        const pattern = SCORING_PATTERN_MAP.get(id)
        if (!pattern) return null
        return {
          id: pattern.id,
          title: pattern.title,
          fan: pattern.fan,
          category: pattern.category,
        }
      })
      .filter(Boolean) as MatchedPattern[],
  )

  const hasLimitPattern = patterns.some((p) => p.fan === 'limit' || LIMIT_PATTERN_IDS.includes(p.id))

  let rawFan: number
  if (hasLimitPattern) {
    rawFan = rules.maxFan
  } else {
    rawFan = patterns.reduce((sum, p) => sum + fanToNumber(p.fan, rules.maxFan), 0)
  }

  const totalFan = hasLimitPattern ? rules.maxFan : Math.min(rawFan, rules.maxFan)
  const isCapped = !hasLimitPattern && rawFan > rules.maxFan

  return {
    patterns,
    totalFan,
    rawFan,
    hasLimitPattern,
    isCapped,
    isLimit: hasLimitPattern || isCapped,
    meetsMinFan: totalFan >= rules.minFan,
  }
}
