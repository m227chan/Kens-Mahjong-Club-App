import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { signTableQr, tableQrUrl, verifyTableQr } from '../lib/qr-signing'
import { calculateTableScores } from '../lib/table-scoring'

const players = ['east', 'south', 'west', 'north']

describe('focused table scoring', () => {
  it('scores a self-draw as three equal payments', () => {
    expect(calculateTableScores({ players, winner: 'east', winType: 'self', fan: 6 })).toEqual({
      east: 96,
      south: -32,
      west: -32,
      north: -32,
    })
  })

  it('scores a discard win only against the discarder', () => {
    expect(calculateTableScores({ players, winner: 'east', loser: 'south', winType: 'discard', fan: 13 })).toEqual({
      east: 768,
      south: -768,
      west: 0,
      north: 0,
    })
  })

  it('rejects incomplete tables and invalid winners', () => {
    expect(calculateTableScores({ players: players.slice(0, 3), winner: 'east', winType: 'self', fan: 6 })).toBeNull()
    expect(calculateTableScores({ players, winner: 'visitor', winType: 'self', fan: 6 })).toBeNull()
  })

  it('uses a club-specific fan range and point mapping', () => {
    const rules = { minFan: 1, maxFan: 4, fanPoints: { 1: 2, 2: 5, 3: 9, 4: 20 } }
    expect(calculateTableScores({ players, winner: 'east', winType: 'self', fan: 2, rules })).toEqual({
      east: 15,
      south: -5,
      west: -5,
      north: -5,
    })
    expect(calculateTableScores({ players, winner: 'east', winType: 'self', fan: 8, rules })).toEqual({
      east: 60,
      south: -20,
      west: -20,
      north: -20,
    })
    expect(calculateTableScores({ players, winner: 'east', winType: 'self', fan: 0, rules })).toBeNull()
  })
})

describe('table QR signatures', () => {
  const identity = { clubId: 'club-example', tableNumber: 3, tokenVersion: 1, publicId: 'public-example' }

  beforeEach(() => {
    process.env.QR_SIGNING_SECRET = 'test-only-secret-at-least-32-bytes'
    process.env.NEXT_PUBLIC_APP_URL = 'https://mahjong.example/'
  })

  afterEach(() => {
    delete process.env.QR_SIGNING_SECRET
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  it('validates only the exact table identity', () => {
    const signature = signTableQr(identity)
    expect(verifyTableQr(identity, signature)).toBe(true)
    expect(verifyTableQr({ ...identity, tableNumber: 4 }, signature)).toBe(false)
  })

  it('keeps the secret in the URL fragment instead of the request path or query', () => {
    const url = tableQrUrl('https://ignored.example', identity)
    expect(url).toMatch(/^https:\/\/mahjong\.example\/check-in\/public-example#k=/)
    expect(url).not.toContain('?')
  })
})
