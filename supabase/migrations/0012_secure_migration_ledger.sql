begin;

-- Migration bookkeeping is administrative metadata and must not be reachable
-- through the public schema exposed by Supabase's Data API. The schema runner
-- performs the same move during bootstrap so it can locate the ledger before
-- deciding which migrations are pending.
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
