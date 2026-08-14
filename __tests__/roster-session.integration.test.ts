import { randomUUID } from 'node:crypto'
import { Client } from 'pg'
import { describe, expect, it } from 'vitest'
import { addPlayerToActiveSession } from '@/lib/server/roster-session'

const connectionString = process.env.SUPABASE_DATABASE_URL

describe.skipIf(!connectionString)('new roster player session enrollment', () => {
  it('adds a new player to the active session sideline exactly once', async () => {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
    await client.connect()
    await client.query('begin')
    try {
      const clubId = `R${randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase()}`
      const existingId = `existing-${randomUUID()}`
      const newId = `new-${randomUUID()}`
      await client.query("insert into clubs(id,name,manager_uid) values($1,'Roster test','manager-test')", [clubId])
      await client.query("insert into seasons(club_id,season_number,name,created_by) values($1,1,'Season 1','manager-test')", [clubId])
      await client.query("insert into players(id,club_id,display_name,icon) values($1,$2,'Existing','🀄'),($3,$2,'New','🌸')", [existingId, clubId, newId])
      await client.query("insert into sessions(club_id,created_by,season_number,table_count,participants,tables,sideline,revision) values($1,'manager-test',1,1,$2,$3,'{}',4)", [clubId, [existingId], JSON.stringify({ 1: [existingId] })])

      expect(await addPlayerToActiveSession(client, clubId, newId)).toBe(true)
      expect(await addPlayerToActiveSession(client, clubId, newId)).toBe(true)

      const session = (await client.query('select participants,tables,sideline,revision from sessions where club_id=$1 and is_active', [clubId])).rows[0]
      expect(session.participants).toEqual([existingId, newId])
      expect(session.tables).toEqual({ 1: [existingId] })
      expect(session.sideline).toEqual([newId])
      expect(Number(session.revision)).toBe(5)
    } finally {
      await client.query('rollback')
      await client.end()
    }
  }, 20_000)

  it('does nothing when the club has no active session', async () => {
    const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } })
    await client.connect()
    await client.query('begin')
    try {
      const clubId = `N${randomUUID().replace(/-/g, '').slice(0, 5).toUpperCase()}`
      const playerId = `new-${randomUUID()}`
      await client.query("insert into clubs(id,name,manager_uid) values($1,'No session','manager-test')", [clubId])
      await client.query("insert into players(id,club_id,display_name,icon) values($1,$2,'New','🌸')", [playerId, clubId])
      expect(await addPlayerToActiveSession(client, clubId, playerId)).toBe(false)
    } finally {
      await client.query('rollback')
      await client.end()
    }
  }, 20_000)
})
