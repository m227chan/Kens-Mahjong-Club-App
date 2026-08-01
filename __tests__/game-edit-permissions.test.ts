import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { canEditGameRecord } from '@/lib/server/supabase-game-management'

describe('game edit permissions', () => {
  const now = Date.UTC(2026, 6, 31, 12)

  it('allows a member to edit their own game through the 24-hour window', () => {
    expect(canEditGameRecord('member', 'member-1', {
      createdBy: 'member-1',
      createdAt: new Date(now - 24 * 60 * 60 * 1000),
    }, now)).toBe(true)
  })

  it('rejects another member or an expired game', () => {
    expect(canEditGameRecord('member', 'member-2', {
      createdBy: 'member-1',
      createdAt: new Date(now - 60 * 60 * 1000),
    }, now)).toBe(false)
    expect(canEditGameRecord('member', 'member-1', {
      createdBy: 'member-1',
      createdAt: new Date(now - 24 * 60 * 60 * 1000 - 1),
    }, now)).toBe(false)
  })

  it('keeps manager edit access unrestricted', () => {
    expect(canEditGameRecord('manager', 'manager-1', {
      createdBy: 'member-1',
      createdAt: new Date(0),
    }, now)).toBe(true)
  })
})
