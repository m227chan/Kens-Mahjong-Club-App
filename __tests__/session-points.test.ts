import { describe, expect, it } from 'vitest'
import {
  buildCustomSessionWindow,
  normalizeSessionPointHours,
  normalizeSessionPointWindow,
} from '@/lib/session-point-window'

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

  it('rejects other preset windows', () => {
    expect(() => normalizeSessionPointHours(12)).toThrow(
      /24 hour, 48 hour, or 7 day/i,
    )
    expect(() => normalizeSessionPointHours(72)).toThrow(
      /24 hour, 48 hour, or 7 day/i,
    )
  })

  it('normalizes custom inclusive date ranges to ISO bounds', () => {
    const window = buildCustomSessionWindow('2026-08-01', '2026-08-03')
    expect(window.mode).toBe('range')
    expect(window.startDate).toBe('2026-08-01')
    expect(window.endDate).toBe('2026-08-03')
    expect(Date.parse(window.startAt)).toBeLessThan(Date.parse(window.endAt))
    expect(
      normalizeSessionPointWindow({
        mode: 'range',
        startDate: window.startDate,
        endDate: window.endDate,
        startAt: window.startAt,
        endAt: window.endAt,
      }),
    ).toEqual(window)
  })

  it('rejects inverted or oversized custom ranges', () => {
    expect(() => buildCustomSessionWindow('2026-08-03', '2026-08-01')).toThrow(
      /start date must be on or before/i,
    )
    expect(() => buildCustomSessionWindow('2024-01-01', '2026-08-01')).toThrow(
      /366 days or fewer/i,
    )
  })

  it('sums game deltas as period net change, not a standing total', () => {
    // start 100, then +30 +20 -100 +10 -10 => -50 for the window
    expect(netChangeForWindow([30, 20, -100, 10, -10])).toBe(-50)
  })
})
