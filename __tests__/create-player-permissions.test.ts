import { NextRequest } from 'next/server'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  verifyIdToken: vi.fn(),
  withTransaction: vi.fn(),
  mutateSupabaseGames: vi.fn(),
}))

vi.mock('@/lib/firebase-admin', () => ({
  adminAuth: { verifyIdToken: mocks.verifyIdToken },
}))

vi.mock('@/lib/postgres-admin', () => ({
  withTransaction: mocks.withTransaction,
}))

vi.mock('@/lib/server/supabase-game-management', () => ({
  mutateSupabaseGames: mocks.mutateSupabaseGames,
}))

import { POST } from '@/app/api/supabase-data/route'

function createRequest() {
  return new NextRequest('https://mahjong.example/api/supabase-data', {
    method: 'POST',
    headers: { authorization: 'Bearer valid-token' },
    body: JSON.stringify({
      action: 'createPlayer',
      clubId: 'CLUB01',
      input: { displayName: 'New player', icon: '🀄' },
    }),
  })
}

describe('createPlayer authorization', () => {
  beforeEach(() => {
    mocks.verifyIdToken.mockReset().mockResolvedValue({ uid: 'member-uid' })
    mocks.mutateSupabaseGames.mockReset()
    mocks.withTransaction.mockReset()
  })

  it('allows an active club member to add a roster player', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('from club_members')) return { rowCount: 1, rows: [] }
      return { rowCount: 1, rows: [] }
    })
    mocks.withTransaction.mockImplementation(async (operation) =>
      operation({ query } as never),
    )

    const response = await POST(createRequest())

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ result: expect.any(String) })
    const membershipQuery = query.mock.calls.find(([sql]) =>
      String(sql).includes('from club_members'),
    )?.[0]
    expect(membershipQuery).toContain('and active')
    expect(membershipQuery).not.toContain("role='manager'")
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('insert into players'),
      expect.arrayContaining(['CLUB01', 'New player', '🀄']),
    )
  })

  it('does not allow someone who has not joined the club to add a player', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('from club_members')) return { rowCount: 0, rows: [] }
      return { rowCount: 1, rows: [] }
    })
    mocks.withTransaction.mockImplementation(async (operation) =>
      operation({ query } as never),
    )

    const response = await POST(createRequest())

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({
      error: 'Only an active club member can do that.',
    })
    expect(query).not.toHaveBeenCalledWith(
      expect.stringContaining('insert into players'),
      expect.anything(),
    )
  })
})
