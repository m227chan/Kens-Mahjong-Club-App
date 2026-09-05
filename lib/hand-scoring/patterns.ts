import { WIKI_HAND_SECTIONS } from '@/app/wiki/wiki-content'
import { parseFanValue } from './parse-fan'
import type { PatternCategory } from './types'

export type ScoringPattern = {
  id: string
  title: string
  fan: number | 'limit'
  category: PatternCategory
  description: string
  nonTraditional?: boolean
  manualOnly?: boolean
  excludes?: string[]
  sectionId: string
}

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

function categoryForSection(sectionId: string, fan: number | 'limit'): PatternCategory {
  if (fan === 'limit') return 'limit'
  if (sectionId === 'bonus-flowers') return 'flower'
  if (sectionId === 'winning-methods') return 'winning-method'
  if (sectionId === 'special-hands') return 'special'
  return 'hand'
}

const MANUAL_ONLY_TITLES = new Set([
  'Self Draw',
  'Concealed Hand',
  'Win on Final Tile',
  'After a Kong',
  'After Multiple Kongs',
  'Robbing a Kong',
  'Blessing of Heaven',
  'Blessing of Earth',
  'Blessing of Man',
])

const EXCLUSION_MAP: Record<string, string[]> = {
  'small-three-dragons': ['dragon-triplet'],
  'big-three-dragons': ['dragon-triplet'],
  'small-four-winds': ['round-wind', 'seat-wind', 'mixed-flush'],
  'big-four-winds': ['round-wind', 'seat-wind', 'mixed-flush', 'small-four-winds'],
  '7-flowers': ['no-flowers', 'seat-flower', 'double-flower', 'set-of-flowers'],
  '8-flowers': ['no-flowers', 'seat-flower', 'double-flower', 'set-of-flowers', '7-flowers'],
  'set-of-flowers': ['no-flowers', 'seat-flower', 'double-flower'],
  'double-flower': ['no-flowers', 'seat-flower'],
  'seat-flower': ['no-flowers'],
}

export const SCORING_PATTERNS: ScoringPattern[] = WIKI_HAND_SECTIONS.flatMap((section) =>
  section.hands.map((hand) => {
    const id = slugify(hand.title)
    const fan = parseFanValue(hand.value)
    return {
      id,
      title: hand.title,
      fan,
      category: categoryForSection(section.id, fan),
      description: hand.description,
      nonTraditional: hand.nonTraditional,
      manualOnly: hand.type === 'condition-only' || MANUAL_ONLY_TITLES.has(hand.title),
      excludes: EXCLUSION_MAP[id],
      sectionId: section.id,
    }
  }),
)

export const SCORING_PATTERN_MAP = new Map(SCORING_PATTERNS.map((p) => [p.id, p]))

export function getPattern(id: string): ScoringPattern | undefined {
  return SCORING_PATTERN_MAP.get(id)
}

export function patternsForCalculator(includeNonTraditional: boolean): ScoringPattern[] {
  return SCORING_PATTERNS.filter((p) => includeNonTraditional || !p.nonTraditional)
}

export const LIMIT_PATTERN_IDS = SCORING_PATTERNS.filter((p) => p.fan === 'limit').map((p) => p.id)

export const MANUAL_BONUS_PATTERNS = SCORING_PATTERNS.filter((p) => p.manualOnly)
