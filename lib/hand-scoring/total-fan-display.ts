import { fanLabel, type ScoringRules } from '@/lib/scoring-rules'
import type { FanCalculationResult } from './types'

export type TotalFanDisplay = {
  main: string
  limitLabel: string | null
}

export function totalFanDisplay(
  result: FanCalculationResult,
  rules: ScoringRules,
): TotalFanDisplay {
  if (!result.isLimit) {
    return { main: fanLabel(result.totalFan, rules), limitLabel: null }
  }

  const limitLabel = result.isCapped
    ? `Limit (${result.rawFan})`
    : result.rawFan > result.totalFan
      ? `Limit (${result.rawFan})`
      : 'Limit'

  return {
    main: fanLabel(result.totalFan, rules),
    limitLabel,
  }
}
