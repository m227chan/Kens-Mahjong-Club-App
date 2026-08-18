import { beforeEach, describe, expect, it, vi } from 'vitest'
import { allSessionWindow } from '@/lib/session-point-window'

const { query, getSupabaseBrowserClientMock } = vi.hoisted(() => {
  const queryBuilder: Record<string, ReturnType<typeof vi.fn>> = {}
  queryBuilder.select = vi.fn(() => queryBuilder)
  queryBuilder.eq = vi.fn(() => queryBuilder)
  queryBuilder.order = vi.fn(() => queryBuilder)
  queryBuilder.gte = vi.fn(() => queryBuilder)
  queryBuilder.lt = vi.fn(() => queryBuilder)
  queryBuilder.lte = vi.fn(() => queryBuilder)
  queryBuilder.range = vi.fn().mockResolvedValue({ data: [], error: null })
  return {
    query: queryBuilder,
    getSupabaseBrowserClientMock: vi.fn(() => ({ from: vi.fn(() => queryBuilder) })),
  }
})

vi.mock('@/lib/supabase', () => ({ getSupabaseBrowserClient: getSupabaseBrowserClientMock }))
vi.mock('@/lib/firebase', () => ({ auth: { currentUser: null } }))

import { loadAnalyticsGames } from '@/lib/supabase-data'

describe('analytics game queries', () => {
  beforeEach(() => {
    Object.values(query).forEach((mock) => mock.mockClear())
    query.range.mockResolvedValue({ data: [], error: null })
  })

  it('filters an all-time season query in the database', async () => {
    await loadAnalyticsGames('SEASON_QUERY_TEST', allSessionWindow(), 7)

    expect(query.eq).toHaveBeenCalledWith('club_id', 'SEASON_QUERY_TEST')
    expect(query.eq).toHaveBeenCalledWith('season_number', 7)
  })
})
