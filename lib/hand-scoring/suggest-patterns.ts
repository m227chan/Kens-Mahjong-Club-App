import type { ScoringRules } from '@/lib/scoring-rules'
import { calculateFan } from './calculate-fan'
import { detectPatterns, isPatternCompatible } from './detect-patterns'
import { fanToNumber } from './parse-fan'
import { SCORING_PATTERN_MAP, patternsForCalculator } from './patterns'
import type { HandScoringInput, PatternSuggestion } from './types'

export function suggestPatterns(
  input: HandScoringInput,
  rules: ScoringRules,
): PatternSuggestion[] {
  const current = calculateFan(input, rules)
  const currentIds = new Set(current.patterns.map((p) => p.id))
  const detected = new Set(detectPatterns(input))
  const allowed = patternsForCalculator(input.includeNonTraditional)

  const suggestions: PatternSuggestion[] = []

  for (const pattern of allowed) {
    if (currentIds.has(pattern.id)) continue
    if (detected.has(pattern.id)) continue

    const compatible = isPatternCompatible(input, pattern.id)
    if (!compatible) continue

    const fanValue = fanToNumber(pattern.fan, rules.maxFan)
    const addedFan = pattern.fan === 'limit' ? rules.maxFan : fanValue
    const potentialFan = Math.min(rules.maxFan, current.totalFan + addedFan)
    const fanGap =
      pattern.fan === 'limit'
        ? current.totalFan >= rules.maxFan
          ? 0
          : rules.maxFan - current.totalFan
        : potentialFan >= rules.minFan
          ? 0
          : rules.minFan - potentialFan

    suggestions.push({
      id: pattern.id,
      title: pattern.title,
      fan: pattern.fan,
      fanGap,
      compatible: true,
      manualOnly: Boolean(pattern.manualOnly),
    })
  }

  return suggestions.sort((a, b) => {
    const aGap = a.fanGap ?? Number.MAX_SAFE_INTEGER
    const bGap = b.fanGap ?? Number.MAX_SAFE_INTEGER
    if (aGap !== bGap) return aGap - bGap
    return fanToNumber(b.fan, rules.maxFan) - fanToNumber(a.fan, rules.maxFan)
  })
}

export function getPatternDescription(id: string): string {
  return SCORING_PATTERN_MAP.get(id)?.description ?? ''
}
