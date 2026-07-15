import 'server-only'
import { Pool, type PoolClient } from 'pg'

let pool: Pool | undefined

function cleanEnvironmentValue(value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return ''
  const wrapped = (trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  return wrapped ? trimmed.slice(1, -1).trim() : trimmed
}

function getPool() {
  if (pool) return pool
  const connectionString = cleanEnvironmentValue(process.env.SUPABASE_DATABASE_URL)
  if (!connectionString) throw new Error('SUPABASE_DATABASE_URL is not configured.')
  // A small per-instance pool is enough for short game transactions and avoids
  // multiplying database connections when the serverless app scales out.
  pool = new Pool({ connectionString, max: 2, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000, ssl: { rejectUnauthorized: false } })
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
