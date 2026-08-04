import { describe, expect, it } from 'vitest'
import { normalizeSessionPointHours } from '@/lib/server/session-points'

/** Mirrors the intended window math: sum of per-game deltas only. */
function netChangeForWindow(deltas: number[]) {
  return deltas.reduce((sum, score) => sum + score, 0)
}

describe('session point windows', () => {
  it('accepts 24, 48, and 7 day windows', () => {
    expect(normalizeSessionPointHours(24)).toBe(24)
    expect(normalizeSessionPointHours(48)).toBe(48)
    expect(normalizeSessionPointHours(168)).toBe(168)
    expect(normalizeSessionPointHours('24')).toBe(24)
  })

  it('rejects other windows', () => {
    expect(() => normalizeSessionPointHours(12)).toThrow(/24 hour, 48 hour, or 7 day/i)
    expect(() => normalizeSessionPointHours(72)).toThrow(/24 hour, 48 hour, or 7 day/i)
  })

  it('sums game deltas as period net change, not a standing total', () => {
    // start 100, then +30 +20 -100 +10 -10 => -50 for the window
    expect(netChangeForWindow([30, 20, -100, 10, -10])).toBe(-50)
  })
})
