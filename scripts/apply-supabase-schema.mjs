import { readdir, readFile } from 'node:fs/promises'
import pg from 'pg'

if (!process.env.SUPABASE_DATABASE_URL) throw new Error('Missing SUPABASE_DATABASE_URL in .env.local.')
const client = new pg.Client({ connectionString: process.env.SUPABASE_DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  await client.query(`create table if not exists public.app_schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  )`)
  const migrationDirectory = new URL('../supabase/migrations/', import.meta.url)
  const filenames = (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort()
  const applied = new Set((await client.query('select filename from public.app_schema_migrations')).rows.map((row) => row.filename))

  for (const filename of filenames) {
    if (applied.has(filename)) continue
    if (filename === '0001_initial_schema.sql') {
      const existingSchema = await client.query("select to_regclass('public.clubs') as clubs")
      if (existingSchema.rows[0]?.clubs) {
        await client.query('insert into public.app_schema_migrations(filename) values($1)', [filename])
        console.log(`Recorded existing schema: ${filename}`)
        continue
      }
    }
    const sql = await readFile(new URL(filename, migrationDirectory), 'utf8')
    await client.query(sql)
    await client.query('insert into public.app_schema_migrations(filename) values($1)', [filename])
    console.log(`Applied migration: ${filename}`)
  }
  console.log('Supabase schema is current.')
} finally {
  await client.end()
}
