begin;

alter table public.sessions
  add column if not exists revision bigint not null default 0;

create unique index if not exists players_one_active_auth_link_per_club
  on public.players(club_id, auth_uid)
  where active and auth_uid is not null;

create table if not exists public.club_qr_tables (
  id text primary key default encode(gen_random_bytes(10), 'hex'),
  club_id text not null references public.clubs(id) on delete cascade,
  table_number integer not null check (table_number > 0),
  label text,
  public_id text not null unique default encode(gen_random_bytes(16), 'hex'),
  token_version integer not null default 1 check (token_version > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, table_number)
);

create table if not exists public.session_table_activity (
  session_id text not null references public.sessions(id) on delete cascade,
  table_number integer not null check (table_number > 0),
  occupied_since timestamptz,
  last_game_at timestamptz,
  last_roster_change_at timestamptz not null default now(),
  cleared_at timestamptz,
  primary key (session_id, table_number)
);

create index if not exists session_table_activity_deadline_idx
  on public.session_table_activity((coalesce(last_game_at, occupied_since)))
  where occupied_since is not null;

alter table public.club_qr_tables enable row level security;
alter table public.session_table_activity enable row level security;

drop policy if exists qr_tables_manager_read on public.club_qr_tables;
create policy qr_tables_manager_read on public.club_qr_tables
  for select to authenticated using (public.is_club_manager(club_id));

drop policy if exists table_activity_member_read on public.session_table_activity;
create policy table_activity_member_read on public.session_table_activity
  for select to authenticated using (
    exists (
      select 1 from public.sessions s
      where s.id = session_id and public.is_club_member(s.club_id)
    )
  );

create or replace function public.clear_stale_session_tables()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  stale record;
  occupants text[];
  cleared_count integer := 0;
begin
  for stale in
    select a.session_id, a.table_number
    from public.session_table_activity a
    join public.sessions s on s.id = a.session_id and s.is_active
    where a.occupied_since is not null
      and coalesce(a.last_game_at, a.occupied_since) <= now() - interval '2 hours'
    for update of a skip locked
  loop
    perform 1 from public.sessions where id = stale.session_id for update;
    select coalesce(array_agg(value), '{}'::text[])
      into occupants
      from public.sessions s,
        lateral jsonb_array_elements_text(coalesce(s.tables -> stale.table_number::text, '[]'::jsonb)) value
      where s.id = stale.session_id;

    if coalesce(array_length(occupants, 1), 0) > 0 then
      update public.sessions
      set tables = jsonb_set(tables, array[stale.table_number::text], '[]'::jsonb, true),
          sideline = array(select distinct player_id from unnest(sideline || occupants) player_id),
          revision = revision + 1
      where id = stale.session_id and is_active;
      cleared_count := cleared_count + 1;
    end if;

    update public.session_table_activity
    set occupied_since = null,
        last_game_at = null,
        last_roster_change_at = now(),
        cleared_at = now()
    where session_id = stale.session_id and table_number = stale.table_number;
  end loop;

  return cleared_count;
end;
$$;

commit;

-- Supabase Cron is optional in local development. In hosted Supabase, schedule:
-- select cron.schedule('clear-idle-mahjong-tables', '*/5 * * * *',
--   'select public.clear_stale_session_tables()');
