import { describe, expect, it, vi } from 'vitest'
import type { ClientBase } from 'pg'
import { startNewClubSeason, startNewClubTournament } from '@/lib/server/season-management'

function competitionDb(nextSeasonNumber: number, nextKindNumber: number) {
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ next: nextSeasonNumber }] })
    .mockResolvedValueOnce({ rows: [{ next: nextKindNumber }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
  return { query, db: { query } as unknown as ClientBase }
}

describe('season and tournament lifecycle', () => {
  it('creates a custom-named tournament with its own competition type', async () => {
    const { db, query } = competitionDb(4, 2)

    const result = await startNewClubTournament(db, 'CLUB1', 'manager-1', '  Summer   Open  ')

    expect(result).toEqual({ seasonNumber: 4, name: 'Summer Open', kind: 'tournament' })
    expect(query).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining('competition_type'),
      ['CLUB1', 4, 'Summer Open', 'manager-1', 'tournament'],
    )
  })

  it('numbers regular seasons independently from tournaments', async () => {
    const { db, query } = competitionDb(5, 3)

    await expect(startNewClubSeason(db, 'CLUB1', 'manager-1')).resolves.toBe(5)
    expect(query).toHaveBeenNthCalledWith(
      6,
      expect.stringContaining('competition_type'),
      ['CLUB1', 5, 'Season 3', 'manager-1', 'season'],
    )
  })

  it('uses an incrementing default tournament name', async () => {
    const { db } = competitionDb(6, 4)

    await expect(startNewClubTournament(db, 'CLUB1', 'manager-1')).resolves.toEqual({
      seasonNumber: 6,
      name: 'Tournament 4',
      kind: 'tournament',
    })
  })
})
