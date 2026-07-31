import { readdir, readFile } from 'node:fs/promises'
import pg from 'pg'

const connectionString = process.env.MIGRATION_DATABASE_URL || process.env.SUPABASE_DATABASE_URL
if (!connectionString) throw new Error('Missing MIGRATION_DATABASE_URL in .env.local.')
const client = new pg.Client({ connectionString, ssl: { rejectUnauthorized: false } })
await client.connect()
try {
  // Keep the migration ledger outside schemas exposed by Supabase's Data API.
  // The bootstrap is intentionally repeated here (in addition to migration
  // 0012) because the runner must find the ledger before it can apply pending
  // migrations.
  await client.query(`
    begin;

    create schema if not exists app_internal;

    do $$
    begin
      if to_regclass('app_internal.app_schema_migrations') is null
        and to_regclass('public.app_schema_migrations') is not null then
        alter table public.app_schema_migrations set schema app_internal;
      end if;
    end
    $$;

    create table if not exists app_internal.app_schema_migrations (
      filename text primary key,
      applied_at timestamptz not null default now()
    );

    do $$
    declare
      role_name text;
    begin
      revoke all on schema app_internal from public;
      revoke all on table app_internal.app_schema_migrations from public;

      foreach role_name in array array['anon', 'authenticated', 'service_role', 'app_runtime']
      loop
        if exists (select 1 from pg_roles where rolname = role_name) then
          execute format('revoke all on schema app_internal from %I', role_name);
          execute format(
            'revoke all on table app_internal.app_schema_migrations from %I',
            role_name
          );
        end if;
      end loop;
    end
    $$;

    commit;
  `)
  const migrationDirectory = new URL('../supabase/migrations/', import.meta.url)
  const filenames = (await readdir(migrationDirectory)).filter((name) => name.endsWith('.sql')).sort()
  const applied = new Set(
    (await client.query('select filename from app_internal.app_schema_migrations')).rows.map((row) => row.filename),
  )

  for (const filename of filenames) {
    if (applied.has(filename)) continue
    if (filename === '0001_initial_schema.sql') {
      const existingSchema = await client.query("select to_regclass('public.clubs') as clubs")
      if (existingSchema.rows[0]?.clubs) {
        await client.query('insert into app_internal.app_schema_migrations(filename) values($1)', [filename])
        console.log(`Recorded existing schema: ${filename}`)
        continue
      }
    }
    const sql = await readFile(new URL(filename, migrationDirectory), 'utf8')
    await client.query(sql)
    await client.query('insert into app_internal.app_schema_migrations(filename) values($1)', [filename])
    console.log(`Applied migration: ${filename}`)
  }

  const ledgerSecurity = await client.query(`
    select
      to_regclass('public.app_schema_migrations') as public_ledger,
      to_regclass('app_internal.app_schema_migrations') as internal_ledger,
      exists (
        select 1
        from pg_roles
        where rolname in ('anon', 'authenticated', 'service_role', 'app_runtime')
          and (
            has_schema_privilege(rolname, 'app_internal', 'usage')
            or has_table_privilege(
              rolname,
              'app_internal.app_schema_migrations',
              'select,insert,update,delete,truncate,references,trigger'
            )
          )
      ) as exposed_to_application_role
  `)
  const ledger = ledgerSecurity.rows[0]
  if (ledger.public_ledger || !ledger.internal_ledger || ledger.exposed_to_application_role) {
    throw new Error('Migration ledger security verification failed.')
  }

  console.log('Supabase schema is current.')
} finally {
  await client.end()
}
