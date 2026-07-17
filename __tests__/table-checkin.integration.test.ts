import { Client, type PoolClient } from 'pg'
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))

import { mutateTable } from '@/lib/server/table-checkin'

const connectionString = process.env.SUPABASE_DATABASE_URL

describe.skipIf(!connectionString)('transactional table mutations', () => {
  it('clears, seats, and removes a player without duplicate occupancy', async () => {
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
    await client.connect()
    await client.query('begin')
    try {
      const fixture = (
        await client.query(
          `select s.club_id,m.firebase_uid,p.id player_id
           from sessions s
           join club_members m on m.club_id=s.club_id and m.active
           join players p on p.club_id=s.club_id and p.active
           where s.is_active
           order by s.created_at desc
           limit 1`,
        )
      ).rows[0]
      expect(fixture).toBeTruthy()
      const db = client as unknown as PoolClient
      const caller = { uid: String(fixture.firebase_uid) }
      const clubId = String(fixture.club_id)
      const playerId = String(fixture.player_id)

      await mutateTable(db, caller, {
        action: 'clear',
        clubId,
        tableNumber: 99,
      })
      const seated = await mutateTable(db, caller, {
        action: 'seat',
        clubId,
        tableNumber: 99,
        playerId,
      })
      expect(seated.status).toBe('ok')
      if (seated.status !== 'ok') throw new Error('Expected an open table.')
      if (!seated.session) throw new Error('Expected an active session.')
      expect(seated.session.tables['99']).toContain(playerId)
      expect(
        Object.values(seated.session.tables)
          .flat()
          .filter((id) => id === playerId),
      ).toHaveLength(1)

      const removed = await mutateTable(db, caller, {
        action: 'remove',
        clubId,
        tableNumber: 99,
        playerId,
      })
      expect(removed.status).toBe('ok')
      if (removed.status !== 'ok') throw new Error('Expected removal to work.')
      if (!removed.session) throw new Error('Expected an active session.')
      expect(removed.session.tables['99']).not.toContain(playerId)
      expect(removed.session.sideline).toContain(playerId)
    } finally {
      await client.query('rollback')
      await client.end()
    }
  }, 20_000)
})
