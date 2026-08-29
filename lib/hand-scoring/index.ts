export { calculateFan } from './calculate-fan'
export { detectPatterns, isPatternCompatible } from './detect-patterns'
export { suggestPatterns, getPatternDescription } from './suggest-patterns'
export { SCORING_PATTERNS, SCORING_PATTERN_MAP, MANUAL_BONUS_PATTERNS, getPattern } from './patterns'
export { parseFanValue, fanToNumber } from './parse-fan'
export type {
  HandScoringInput,
  Meld,
  Wind,
  FanCalculationResult,
  MatchedPattern,
  PatternSuggestion,
} from './types'
