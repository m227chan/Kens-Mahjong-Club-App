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
vi.mock('@/lib/postgres-admin', () => ({ withTransaction: mocks.withTransaction }))
vi.mock('@/lib/server/supabase-game-management', () => ({ mutateSupabaseGames: mocks.mutateSupabaseGames }))

import { POST } from '@/app/api/supabase-data/route'

function actionRequest(body: Record<string, unknown>) {
  return new NextRequest('https://mahjong.example/api/supabase-data', {
    method: 'POST',
    headers: { authorization: 'Bearer valid-token' },
    body: JSON.stringify(body),
  })
}

describe('club join approval policy', () => {
  beforeEach(() => {
    mocks.verifyIdToken.mockReset().mockResolvedValue({
      uid: 'member-1',
      email: 'member@example.com',
      name: 'New Member',
      picture: null,
    })
    mocks.withTransaction.mockReset()
  })

  it('adds the user immediately when manager approval is disabled', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('select join_approval_required')) return { rowCount: 1, rows: [{ join_approval_required: false }] }
      if (sql.includes('select 1 from club_members')) return { rowCount: 0, rows: [] }
      return { rowCount: 1, rows: [] }
    })
    mocks.withTransaction.mockImplementation(async (operation) => operation({ query } as never))

    const response = await POST(actionRequest({ action: 'requestToJoinClub', clubId: 'club1' }))

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ result: 'joined' })
    expect(query).toHaveBeenCalledWith(expect.stringContaining('insert into club_members'), expect.arrayContaining(['CLUB1', 'member-1']))
    expect(query).toHaveBeenCalledWith(expect.stringContaining("values($1,$2,$3,$4,$5,'approved'"), expect.any(Array))
  })

  it('leaves the user pending when manager approval is required', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes('select join_approval_required')) return { rowCount: 1, rows: [{ join_approval_required: true }] }
      if (sql.includes('select 1 from club_members')) return { rowCount: 0, rows: [] }
      return { rowCount: 1, rows: [] }
    })
    mocks.withTransaction.mockImplementation(async (operation) => operation({ query } as never))

    const response = await POST(actionRequest({ action: 'requestToJoinClub', clubId: 'CLUB1' }))

    await expect(response.json()).resolves.toEqual({ result: 'requested' })
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('insert into club_members'), expect.anything())
    expect(query).toHaveBeenCalledWith(expect.stringContaining("values($1,$2,$3,$4,$5,'pending')"), expect.any(Array))
  })

  it('only lets an active manager change the club policy', async () => {
    const query = vi.fn(async (sql: string) => {
      if (sql.includes("role='manager'")) return { rowCount: 0, rows: [] }
      return { rowCount: 1, rows: [] }
    })
    mocks.withTransaction.mockImplementation(async (operation) => operation({ query } as never))

    const response = await POST(actionRequest({ action: 'updateClubJoinApproval', clubId: 'CLUB1', joinApprovalRequired: false }))

    expect(response.status).toBe(403)
    await expect(response.json()).resolves.toEqual({ error: 'Only an active club manager can do that.' })
    expect(query).not.toHaveBeenCalledWith(expect.stringContaining('update clubs set join_approval_required'), expect.anything())
  })

  it('admits pending requests when a manager enables instant joining', async () => {
    mocks.verifyIdToken.mockResolvedValue({ uid: 'manager-1' })
    const query = vi.fn(async () => ({ rowCount: 1, rows: [] }))
    mocks.withTransaction.mockImplementation(async (operation) => operation({ query } as never))

    const response = await POST(actionRequest({ action: 'updateClubJoinApproval', clubId: 'CLUB1', joinApprovalRequired: false }))

    expect(response.status).toBe(200)
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining("where club_id=$1 and status='pending'"),
      ['CLUB1', 'manager-1'],
    )
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('insert into club_members'),
      ['CLUB1', 'manager-1'],
    )
  })
})
