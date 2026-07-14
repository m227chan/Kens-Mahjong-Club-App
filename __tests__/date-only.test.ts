import { describe, expect, it } from 'vitest'
import { toDateOnly } from '../lib/date-only'

describe('toDateOnly', () => {
  it('formats database Date objects as calendar dates', () => {
    expect(toDateOnly(new Date(2026, 6, 12))).toBe('2026-07-12')
  })

  it('preserves ISO date strings without applying a timezone shift', () => {
    expect(toDateOnly('2026-07-12')).toBe('2026-07-12')
    expect(toDateOnly('2026-07-12T22:30:00.000Z')).toBe('2026-07-12')
  })

  it('returns null for missing or invalid dates', () => {
    expect(toDateOnly(null)).toBeNull()
    expect(toDateOnly('not-a-date')).toBeNull()
  })
})
