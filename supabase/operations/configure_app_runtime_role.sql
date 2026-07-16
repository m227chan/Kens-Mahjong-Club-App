-- Run as the database owner after replacing the password through the Supabase SQL
-- editor. Do not commit the password or use the app_runtime role for migrations.
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_runtime') then
    create role app_runtime login bypassrls
      nosuperuser nocreatedb nocreaterole noinherit noreplication;
  end if;
end
$$;

alter role app_runtime login bypassrls
  nosuperuser nocreatedb nocreaterole noinherit noreplication;
revoke create on schema public from app_runtime;
grant usage on schema public to app_runtime;
grant select, insert, update, delete on all tables in schema public to app_runtime;
grant usage, select on all sequences in schema public to app_runtime;
grant execute on all functions in schema public to app_runtime;

-- Audit history is append-only through its security-definer trigger. The runtime
-- role cannot read, modify, truncate, or delete it directly.
revoke all on public.game_audit_log from app_runtime;
revoke all on sequence public.game_audit_log_id_seq from app_runtime;

-- Set a generated password separately, then build APP_DATABASE_URL with this user:
-- alter role app_runtime password '<GENERATED PASSWORD>';
