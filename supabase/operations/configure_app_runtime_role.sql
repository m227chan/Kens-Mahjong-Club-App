-- Run as the database owner after replacing the password through the Supabase SQL
-- editor. Do not commit the password or use the app_runtime role for migrations.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    create role app_runtime login noinherit;
  end if;
end
$$;

-- Hosted Supabase permits BYPASSRLS for private server roles, but its managed
-- postgres role is not a true superuser. Do not include SUPERUSER or REPLICATION
-- attributes (even their NO... forms) in this ALTER statement.
alter role app_runtime login bypassrls noinherit;
revoke create on schema public from app_runtime;
grant usage on schema public to app_runtime;
grant select, insert, update, delete on all tables in schema public to app_runtime;
grant usage, select on all sequences in schema public to app_runtime;
grant execute on all functions in schema public to app_runtime;

-- Audit history is append-only through its security-definer trigger. The runtime
-- role cannot read, modify, truncate, or delete it directly.
do $$
begin
  if to_regclass('public.game_audit_log') is not null then
    revoke all on public.game_audit_log from app_runtime;
    revoke all on sequence public.game_audit_log_id_seq from app_runtime;
  end if;
end
$$;

-- Set a generated password separately, then build APP_DATABASE_URL with this user:
-- alter role app_runtime password '<GENERATED PASSWORD>';

-- Expected: login and bypass RLS are true; every other capability is false.
select rolname, rolcanlogin, rolbypassrls, rolsuper, rolcreatedb,
  rolcreaterole, rolreplication
from pg_roles
where rolname = 'app_runtime';
