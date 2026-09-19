import { Client } from 'pg'
import { describe, expect, it } from 'vitest'

const connectionString =
  process.env.MIGRATION_DATABASE_URL || process.env.SUPABASE_DATABASE_URL

describe.skipIf(!connectionString)('club_members RLS hardening', () => {
  it('only allows managers to insert or update club_members via authenticated policies', async () => {
    const client = new Client({
      connectionString,
      ssl: { rejectUnauthorized: false },
    })
    await client.connect()
    try {
      const policies = (
        await client.query(
          `select policyname, cmd, qual, with_check
           from pg_policies
           where schemaname = 'public' and tablename = 'club_members'
           order by policyname`,
        )
      ).rows

      const create = policies.find((row) => row.policyname === 'members_create')
      const update = policies.find((row) => row.policyname === 'members_update')
      expect(create).toBeTruthy()
      expect(update).toBeTruthy()
      expect(String(create.with_check)).toMatch(/is_club_manager/i)
      expect(String(create.with_check)).not.toMatch(/firebase_uid\s*=\s*public\.firebase_uid/i)
      expect(String(update.qual)).toMatch(/is_club_manager/i)
      expect(String(update.with_check)).toMatch(/is_club_manager/i)
      expect(String(update.qual ?? '')).not.toMatch(
        /firebase_uid\s*=\s*public\.firebase_uid/i,
      )
    } finally {
      await client.end()
    }
  })
})
