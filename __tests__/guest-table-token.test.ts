import { afterEach, describe, expect, it, vi } from 'vitest'

describe('guest table token', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it('signs and verifies a scoped guest token', async () => {
    vi.stubEnv('QR_SIGNING_SECRET', 'test-guest-signing-secret-32chars-min')
    const {
      signGuestTableToken,
      verifyGuestTableToken,
      isGuestTableToken,
      guestCallerSubject,
    } = await import('@/lib/guest-table-token')

    const token = signGuestTableToken({ clubId: 'abc123', tableNumber: 2 })
    expect(isGuestTableToken(token)).toBe(true)
    const claims = verifyGuestTableToken(token)
    expect(claims.clubId).toBe('ABC123')
    expect(claims.tableNumber).toBe(2)
    expect(guestCallerSubject(claims)).toBe('guest:ABC123:2')
  })

  it('rejects expired tokens', async () => {
    vi.stubEnv('QR_SIGNING_SECRET', 'test-guest-signing-secret-32chars-min')
    const { signGuestTableToken, verifyGuestTableToken } = await import(
      '@/lib/guest-table-token'
    )
    const token = signGuestTableToken({
      clubId: 'ABC123',
      tableNumber: 1,
      ttlMs: -1,
    })
    expect(() => verifyGuestTableToken(token)).toThrow(/expired/i)
  })

  it('rejects tampered tokens', async () => {
    vi.stubEnv('QR_SIGNING_SECRET', 'test-guest-signing-secret-32chars-min')
    const { signGuestTableToken, verifyGuestTableToken } = await import(
      '@/lib/guest-table-token'
    )
    const token = signGuestTableToken({ clubId: 'ABC123', tableNumber: 1 })
    const tampered = `${token.slice(0, -2)}aa`
    expect(() => verifyGuestTableToken(tampered)).toThrow(/invalid or expired/i)
  })
})
