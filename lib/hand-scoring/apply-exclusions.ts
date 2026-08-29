import type { ScoringPattern } from './patterns'

export function applyExclusions(
  matchedIds: string[],
  patterns: Map<string, ScoringPattern>,
): string[] {
  const excluded = new Set<string>()
  for (const id of matchedIds) {
    const pattern = patterns.get(id)
    if (!pattern?.excludes) continue
    for (const blocked of pattern.excludes) excluded.add(blocked)
  }
  return matchedIds.filter((id) => !excluded.has(id))
}
