import { WIKI_HAND_SECTIONS, type WikiHand } from '@/app/wiki/wiki-content'

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

export const PATTERN_EXAMPLE_MAP = new Map<string, WikiHand>(
  WIKI_HAND_SECTIONS.flatMap((section) => section.hands.map((hand) => [slugify(hand.title), hand])),
)

export function getPatternExample(id: string): WikiHand | undefined {
  return PATTERN_EXAMPLE_MAP.get(id)
}

export function patternHasTileExample(hand: WikiHand): boolean {
  if (hand.type === 'condition-only') return false
  if (hand.type === 'bonus' && (!hand.tiles || hand.tiles.length === 0)) return false
  return Boolean(hand.groups?.length || hand.tiles?.length)
}
