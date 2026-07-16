begin;

create table public.game_audit_log (
  id bigint generated always as identity primary key,
  occurred_at timestamptz not null default now(),
  table_name text not null check (table_name in ('games', 'game_entries')),
  operation text not null check (operation in ('UPDATE', 'DELETE')),
  row_id text not null,
  club_id text,
  actor_uid text,
  database_user text not null default session_user,
  old_row jsonb not null,
  new_row jsonb
);

create index game_audit_log_club_time_idx
  on public.game_audit_log(club_id, occurred_at desc);
create index game_audit_log_row_idx
  on public.game_audit_log(table_name, row_id, occurred_at desc);

alter table public.game_audit_log enable row level security;
revoke all on public.game_audit_log from public, anon, authenticated;

create function public.audit_game_change() returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  old_json jsonb := to_jsonb(old);
  new_json jsonb := case when tg_op = 'UPDATE' then to_jsonb(new) else null end;
  audit_club_id text;
  audit_row_id text;
begin
  if tg_table_name = 'games' then
    audit_club_id := old.club_id;
    audit_row_id := old.id;
  else
    select club_id into audit_club_id from public.games where id = old.game_id;
    audit_row_id := old.game_id || ':' || old.player_id;
  end if;

  insert into public.game_audit_log(table_name, operation, row_id, club_id, actor_uid, old_row, new_row)
  values (
    tg_table_name,
    tg_op,
    audit_row_id,
    audit_club_id,
    nullif(current_setting('app.actor_uid', true), ''),
    old_json,
    new_json
  );
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

revoke all on function public.audit_game_change() from public;

create trigger games_audit_update_delete
before update or delete on public.games
for each row execute function public.audit_game_change();

create trigger game_entries_audit_update_delete
before update or delete on public.game_entries
for each row execute function public.audit_game_change();

commit;
