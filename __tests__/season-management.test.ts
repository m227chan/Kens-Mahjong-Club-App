import { describe, expect, it, vi } from 'vitest'
import type { ClientBase } from 'pg'
import { assertClubCompetitionEditable, deleteClubTournament, endClubTournament, reopenClubTournament, setClubActiveSeason, setClubCurrentCompetition, startNewClubSeason, startNewClubTournament, updateClubTournamentDuration } from '@/lib/server/season-management'

const fullSchema = { edit_windows: true, pausable: true, configurable: true }

function regularSeasonDb(nextSeasonNumber: number, nextKindNumber: number) {
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [{ edit_windows: false, pausable: false }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ next: nextSeasonNumber }] })
    .mockResolvedValueOnce({ rows: [{ next: nextKindNumber }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [] })
  return { query, db: { query } as unknown as ClientBase }
}

function tournamentDb(nextSeasonNumber: number, nextKindNumber: number) {
  const query = vi.fn()
    .mockResolvedValueOnce({ rows: [fullSchema] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [], rowCount: 0 })
    .mockResolvedValueOnce({ rows: [{ next: nextSeasonNumber }] })
    .mockResolvedValueOnce({ rows: [{ next: nextKindNumber }] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [fullSchema] })
    .mockResolvedValueOnce({ rows: [] })
    .mockResolvedValueOnce({ rows: [{ active_season_number: 1, current_competition_number: 1 }] })
    .mockResolvedValueOnce({ rows: [{ competition_type: 'tournament', tournament_seconds_remaining: 86400, tournament_duration_hours: 24 }] })
    .mockResolvedValue({ rows: [], rowCount: 1 })
  return { query, db: { query } as unknown as ClientBase }
}

describe('season and tournament lifecycle', () => {
  it('creates a custom-named tournament with its own competition type', async () => {
    const { db, query } = tournamentDb(4, 2)

    const result = await startNewClubTournament(db, 'CLUB1', 'manager-1', '  Summer   Open  ')

    expect(result).toEqual({ seasonNumber: 4, name: 'Summer Open', kind: 'tournament' })
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('tournament_seconds_remaining'),
      ['CLUB1', 4, 'Summer Open', 'manager-1', 'tournament', 24],
    )
    expect(query.mock.calls.map(([sql]) => String(sql))).toEqual(expect.arrayContaining([
      expect.stringContaining('make_interval(hours=>$6)'),
      expect.stringContaining('current_competition_number=$1'),
    ]))
    expect(query.mock.calls.some(([sql]) => String(sql).includes('update seasons set active=false'))).toBe(false)
    expect(query.mock.calls.some(([sql]) => String(sql).includes('update sessions set is_active=false'))).toBe(false)
  })

  it('numbers regular seasons independently from tournaments', async () => {
    const { db, query } = regularSeasonDb(5, 3)

    await expect(startNewClubSeason(db, 'CLUB1', 'manager-1')).resolves.toBe(5)
    expect(query).toHaveBeenCalledWith(
      expect.stringContaining('competition_type'),
      ['CLUB1', 5, 'Season 3', 'manager-1', 'season'],
    )
  })

  it('uses an incrementing default tournament name', async () => {
    const { db } = tournamentDb(6, 4)

    await expect(startNewClubTournament(db, 'CLUB1', 'manager-1')).resolves.toEqual({
      seasonNumber: 6,
      name: 'Tournament 4',
      kind: 'tournament',
    })
  })

  it('rejects tournament creation until the full clock schema is deployed', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ edit_windows: false, pausable: false }] })

    await expect(startNewClubTournament(
      { query } as unknown as ClientBase,
      'CLUB1',
      'manager-1',
    )).rejects.toThrow('migrations 0020 through 0022')
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('serializes tournament creation and rejects a second unfinished tournament', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [fullSchema] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ name: 'Summer Open' }] })

    await expect(startNewClubTournament(
      { query } as unknown as ClientBase,
      'CLUB1',
      'manager-1',
      'Autumn Open',
      24,
    )).rejects.toThrow('Summer Open must end before another tournament can start')
    expect(query.mock.calls.some(([sql]) => String(sql).includes('insert into seasons'))).toBe(false)
  })

  it('restarts a tournament with its saved duration and makes it current', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [fullSchema] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rows: [fullSchema] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ active_season_number: 2, current_competition_number: 2 }] })
      .mockResolvedValueOnce({ rows: [{ competition_type: 'tournament', tournament_seconds_remaining: 21600, tournament_duration_hours: 6 }] })
      .mockResolvedValue({ rowCount: 1, rows: [] })
    await reopenClubTournament({ query } as unknown as ClientBase, 'CLUB1', 4)
    expect(query.mock.calls.map(([sql]) => String(sql))).toEqual(expect.arrayContaining([
      expect.stringContaining('coalesce(tournament_duration_hours,24)'),
      expect.stringContaining('tournament_seconds_remaining=coalesce'),
      expect.stringContaining('current_competition_number=$1'),
    ]))
  })

  it('rejects reopening a tournament when its clock schema is missing', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ edit_windows: true, pausable: false }] })

    await expect(reopenClubTournament(
      { query } as unknown as ClientBase,
      'CLUB1',
      4,
    )).rejects.toThrow('migrations 0020 through 0022')
    expect(query).toHaveBeenCalledTimes(1)
  })

  it('keeps active seasons editable before the edit-window migration is deployed', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ edit_windows: false, pausable: false }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ '?column?': 1 }] })
    await expect(assertClubCompetitionEditable(
      { query } as unknown as ClientBase,
      'CLUB1',
      2,
    )).resolves.toBeUndefined()
    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining("created_at > now() - interval '48 hours'"),
      ['CLUB1', 2],
    )
  })

  it('pauses the previous tournament and resumes the selected tournament remainder', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [fullSchema] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ active_season_number: 2, current_competition_number: 3 }] })
      .mockResolvedValueOnce({ rows: [{ competition_type: 'tournament', tournament_seconds_remaining: 7200 }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [] })

    await setClubCurrentCompetition({ query } as unknown as ClientBase, 'CLUB1', 4)

    expect(query.mock.calls.map(([sql]) => String(sql))).toEqual(expect.arrayContaining([
      expect.stringContaining('tournament_seconds_remaining=greatest'),
      expect.stringContaining('make_interval'),
      expect.stringContaining('current_competition_number=$1'),
    ]))
  })

  it('rejects making a tournament current when the clock schema is missing', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ edit_windows: true, pausable: false, configurable: false }] })
      .mockResolvedValueOnce({ rows: [{ competition_type: 'tournament' }] })

    await expect(setClubCurrentCompetition(
      { query } as unknown as ClientBase,
      'CLUB1',
      4,
    )).rejects.toThrow('migrations 0020 through 0022')
  })

  it('keeps the active regular season implicitly current before the clock migration', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [{ edit_windows: true, pausable: false, configurable: false }] })
      .mockResolvedValueOnce({ rows: [{ competition_type: 'season' }] })

    await expect(setClubCurrentCompetition(
      { query } as unknown as ClientBase,
      'CLUB1',
      2,
    )).resolves.toBeUndefined()
  })

  it('only permits regular seasons to become the one active season', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })
    await expect(setClubActiveSeason({ query } as unknown as ClientBase, 'CLUB1', 4))
      .rejects.toThrow('regular season')
  })

  it('lets a manager reset an individual tournament to a new saved duration', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [fullSchema] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })

    await updateClubTournamentDuration({ query } as unknown as ClientBase, 'CLUB1', 4, 36)

    expect(query).toHaveBeenLastCalledWith(
      expect.stringContaining('tournament_duration_hours=$3'),
      ['CLUB1', 4, 36],
    )
  })

  it('rejects invalid tournament durations', async () => {
    const query = vi.fn().mockResolvedValueOnce({ rows: [fullSchema] })

    await expect(updateClubTournamentDuration(
      { query } as unknown as ClientBase,
      'CLUB1',
      4,
      0,
    )).rejects.toThrow('1 to 720 hours')
  })

  it('ends a tournament early and returns a current tournament to the active season', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [fullSchema] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ active_season_number: 2, current_competition_number: 4 }] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [] })

    await endClubTournament({ query } as unknown as ClientBase, 'CLUB1', 4)

    expect(query.mock.calls.map(([sql]) => String(sql))).toEqual(expect.arrayContaining([
      expect.stringContaining('tournament_seconds_remaining=0'),
      expect.stringContaining('current_competition_number=active_season_number'),
    ]))
  })

  it('deletes an inactive tournament and its competition data', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [fullSchema] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ active: false, current_competition_number: 2 }] })
      .mockResolvedValue({ rows: [] })
    await deleteClubTournament({ query } as unknown as ClientBase, 'CLUB1', 4)
    expect(query.mock.calls.map(([sql]) => String(sql))).toEqual(expect.arrayContaining([
      expect.stringContaining('delete from sessions'),
      expect.stringContaining('delete from games'),
      expect.stringContaining('delete from seasons'),
    ]))
  })

  it('treats deleting an already-removed tournament as complete', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [fullSchema] })
      .mockResolvedValueOnce({ rowCount: 0, rows: [] })

    await expect(deleteClubTournament(
      { query } as unknown as ClientBase,
      'CLUB1',
      4,
    )).resolves.toBeUndefined()
    expect(query.mock.calls.some(([sql]) => String(sql).includes('delete from seasons'))).toBe(false)
  })

  it('requires an unfinished tournament to end before it can be deleted', async () => {
    const query = vi.fn()
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [fullSchema] })
      .mockResolvedValueOnce({ rowCount: 1, rows: [{ active: false, current_competition_number: 2, tournament_unfinished: true }] })

    await expect(deleteClubTournament(
      { query } as unknown as ClientBase,
      'CLUB1',
      4,
    )).rejects.toThrow('End the tournament before deleting it')
  })
})
