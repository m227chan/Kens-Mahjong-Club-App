import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { GUEST_CROSS_TABLE_SEAT_MESSAGE } from '@/lib/guest-table-messages'
import { assertRateLimit } from '@/lib/server/rate-limit'

describe('guest table security helpers', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('exposes a stable cross-table login message', () => {
    expect(GUEST_CROSS_TABLE_SEAT_MESSAGE).toMatch(/sign in/i)
    expect(GUEST_CROSS_TABLE_SEAT_MESSAGE).toMatch(/another table/i)
  })

  it('rate-limits repeated keys within the window', () => {
    const key = `test-rate-${Date.now()}`
    for (let i = 0; i < 3; i++) {
      assertRateLimit({ key, limit: 3, windowMs: 60_000 })
    }
    expect(() => assertRateLimit({ key, limit: 3, windowMs: 60_000 })).toThrow(
      /too many requests/i,
    )
  })

  it('defaults guest tokens to a 2 hour TTL', async () => {
    vi.stubEnv('QR_SIGNING_SECRET', 'test-guest-signing-secret-32chars-min')
    const { signGuestTableToken, verifyGuestTableToken } = await import(
      '@/lib/guest-table-token'
    )
    const before = Date.now()
    const claims = verifyGuestTableToken(
      signGuestTableToken({ clubId: 'ABC123', tableNumber: 1 }),
    )
    const ttlMs = claims.exp - before
    expect(ttlMs).toBeGreaterThan(1.9 * 60 * 60 * 1000)
    expect(ttlMs).toBeLessThan(2.1 * 60 * 60 * 1000)
  })
})
