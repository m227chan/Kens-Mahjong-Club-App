import 'server-only'
import { Pool, type PoolClient } from 'pg'

let pool: Pool | undefined

function getPool() {
  if (pool) return pool
  const connectionString = process.env.SUPABASE_DATABASE_URL
  if (!connectionString) throw new Error('SUPABASE_DATABASE_URL is not configured.')
  pool = new Pool({ connectionString, max: 5, ssl: { rejectUnauthorized: false } })
  return pool
}

export async function withTransaction<T>(operation: (client: PoolClient) => Promise<T>) {
  const client = await getPool().connect()
  try {
    await client.query('begin')
    const result = await operation(client)
    await client.query('commit')
    return result
  } catch (error) {
    await client.query('rollback')
    throw error
  } finally {
    client.release()
  }
}
