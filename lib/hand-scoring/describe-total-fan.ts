import { basePointsForFan, fanLabel, type ScoringRules } from '@/lib/scoring-rules'
import { fanToNumber } from './parse-fan'
import { totalFanDisplay } from './total-fan-display'
import type { FanCalculationResult } from './types'

export type TotalFanExplanationRow = {
  label: string
  value: string
  emphasis?: boolean
}

export type TotalFanExplanation = {
  rows: TotalFanExplanationRow[]
  notes: string[]
}

export function describeTotalFan(
  result: FanCalculationResult,
  rules: ScoringRules,
): TotalFanExplanation {
  const notes: string[] = []

  if (result.patterns.length === 0) {
    return {
      rows: [],
      notes: [
        'Each matching pattern adds fan. Handbook exclusion rules remove overlapping lower patterns before the total is summed.',
        'Limit hands count at your club maximum fan instead of stacking with other patterns.',
      ],
    }
  }

  const rows: TotalFanExplanationRow[] = result.patterns.map((pattern) => ({
    label: pattern.title,
    value: pattern.fan === 'limit' ? 'Limit' : `${pattern.fan} fan`,
  }))

  if (result.isLimit) {
    const display = totalFanDisplay(result, rules)
    rows.push({
      label: 'Total',
      value: display.limitLabel ? `${display.main} ${display.limitLabel}` : `${display.main} Limit`,
      emphasis: true,
    })
    if (result.isCapped) {
      notes.push(`Stacked fan is capped at your club maximum of ${fanLabel(rules.maxFan, rules)}+.`)
    } else {
      notes.push('Limit hands count at your club maximum fan cap instead of stacking other pattern fan.')
    }
  } else {
    const parts = result.patterns.map((pattern) => fanToNumber(pattern.fan, rules.maxFan))
    rows.push({
      label: 'Total',
      value: `${parts.join(' + ')} = ${fanLabel(result.totalFan, rules)} fan`,
      emphasis: true,
    })
    notes.push('Overlapping lower patterns are removed by handbook exclusion rules before summing.')
  }

  const basePoints = basePointsForFan(result.totalFan, rules)
  if (basePoints !== null) {
    notes.push(`${fanLabel(result.totalFan, rules)} fan maps to ${basePoints} base points for this club.`)
  } else {
    notes.push(`${fanLabel(result.totalFan, rules)} fan has no base-point value in this club mapping.`)
  }

  notes.push(
    result.meetsMinFan
      ? `Meets the ${rules.minFan}+ fan minimum.`
      : `Below the ${rules.minFan} fan minimum required to win.`,
  )

  return { rows, notes }
}
