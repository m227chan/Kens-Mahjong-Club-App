import { describe, expect, it } from 'vitest'
import { CREATED_CLUB_LIMIT_MESSAGE, MAX_CREATED_CLUBS, hasReachedCreatedClubLimit } from '../lib/club-limits'

describe('created club limit', () => {
  it('allows the first six distinct clubs and blocks the seventh', () => {
    expect(MAX_CREATED_CLUBS).toBe(6)
    expect(hasReachedCreatedClubLimit(5)).toBe(false)
    expect(hasReachedCreatedClubLimit(6)).toBe(true)
    expect(hasReachedCreatedClubLimit(7)).toBe(true)
  })

  it('explains that existing clubs remain available', () => {
    expect(CREATED_CLUB_LIMIT_MESSAGE).toContain('limit of 6')
    expect(CREATED_CLUB_LIMIT_MESSAGE).toContain('join or manage existing clubs')
  })
})
