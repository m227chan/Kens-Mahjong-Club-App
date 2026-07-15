begin;

create extension if not exists pgcrypto;

create type public.club_role as enum ('manager', 'member');
create type public.join_request_status as enum ('pending', 'approved', 'declined');
create type public.game_win_type as enum ('self_draw', 'discard', 'draw');

create function public.firebase_uid() returns text
language sql stable
return nullif(auth.jwt()->>'sub', '');

create table public.clubs (
  id text primary key,
  name text not null,
  manager_uid text not null,
  manager_email text,
  manager_display_name text,
  created_at timestamptz not null default now(),
  active_season_number integer not null default 1 check (active_season_number > 0),
  active boolean not null default true,
  universal boolean not null default false,
  deleted_at timestamptz,
  deleted_by text,
  stats_schema_version text,
  stats_cutoff_at timestamptz,
  stats_rebuild_status text,
  stats_rebuild_started_at timestamptz,
  stats_rebuild_completed_at timestamptz,
  stats_rebuild_lease_until timestamptz
);

create table public.user_profiles (
  firebase_uid text primary key,
  email text,
  display_name text,
  photo_url text,
  sound_enabled boolean not null default true,
  ming_welcome_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.club_members (
  club_id text not null references public.clubs(id) on delete cascade,
  firebase_uid text not null,
  email text,
  display_name text,
  photo_url text,
  role public.club_role not null default 'member',
  joined_at timestamptz not null default now(),
  active boolean not null default true,
  universal boolean not null default false,
  primary key (club_id, firebase_uid)
);
create index club_members_user_active_idx on public.club_members(firebase_uid, active);

create function public.is_club_member(target_club_id text) returns boolean
language sql stable security definer set search_path = public
return exists (
  select 1 from public.club_members
  where club_id = target_club_id and firebase_uid = public.firebase_uid() and active
);

create function public.is_club_manager(target_club_id text) returns boolean
language sql stable security definer set search_path = public
return exists (
  select 1 from public.club_members
  where club_id = target_club_id and firebase_uid = public.firebase_uid() and active and role = 'manager'
);

create table public.join_requests (
  club_id text not null references public.clubs(id) on delete cascade,
  firebase_uid text not null,
  email text,
  display_name text,
  photo_url text,
  status public.join_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by text,
  primary key (club_id, firebase_uid)
);
create index join_requests_pending_idx on public.join_requests(club_id, status, created_at);

create table public.players (
  id text primary key default encode(gen_random_bytes(10), 'hex'),
  club_id text not null references public.clubs(id) on delete cascade,
  display_name text not null,
  title text not null default 'Player',
  icon text not null,
  icon_key text,
  auth_uid text,
  created_at timestamptz not null default now(),
  active boolean not null default true
);
create index players_club_active_name_idx on public.players(club_id, active, display_name);
create index players_auth_uid_idx on public.players(auth_uid) where auth_uid is not null;
create unique index players_club_icon_key_unique on public.players(club_id, icon_key) where active and icon_key is not null;

create table public.seasons (
  club_id text not null references public.clubs(id) on delete cascade,
  season_number integer not null check (season_number > 0),
  name text not null,
  created_at timestamptz not null default now(),
  created_by text not null,
  active boolean not null default true,
  primary key (club_id, season_number)
);

create table public.app_configs (
  club_id text primary key references public.clubs(id) on delete cascade,
  title_bands jsonb not null default '[]'::jsonb,
  elo_base_k double precision not null default 32,
  elo_veteran_games_threshold integer not null default 50,
  elo_starting_rating double precision not null default 1500,
  elo_new_player_k double precision,
  elo_intermediate_k double precision,
  elo_new_player_games_threshold integer,
  updated_at timestamptz not null default now()
);

create table public.games (
  id text primary key default encode(gen_random_bytes(10), 'hex'),
  club_id text not null references public.clubs(id) on delete cascade,
  played_at timestamptz not null default now(),
  created_by text not null,
  season_number integer not null default 1 check (season_number > 0),
  table_id text,
  win_type public.game_win_type not null,
  winner_player_id text references public.players(id),
  loser_player_id text references public.players(id),
  fan integer,
  notes text,
  created_at timestamptz not null default now()
);
create index games_club_played_idx on public.games(club_id, played_at desc);
create index games_club_season_played_idx on public.games(club_id, season_number, played_at desc);

create table public.game_entries (
  game_id text not null references public.games(id) on delete cascade,
  player_id text not null references public.players(id),
  score integer not null,
  primary key (game_id, player_id)
);
create index game_entries_player_idx on public.game_entries(player_id, game_id);

create function public.validate_game_entries() returns trigger
language plpgsql as $$
declare entry_count integer; score_total bigint;
begin
  select count(*), coalesce(sum(score), 0) into entry_count, score_total
  from public.game_entries where game_id = coalesce(new.game_id, old.game_id);
  if entry_count > 4 then raise exception 'A game cannot contain more than four players'; end if;
  if entry_count = 4 and score_total <> 0 then raise exception 'Game scores must sum to zero'; end if;
  return coalesce(new, old);
end $$;
create constraint trigger game_entries_valid_after_write
after insert or update on public.game_entries deferrable initially deferred
for each row execute function public.validate_game_entries();

create table public.player_stats (
  club_id text not null references public.clubs(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  total_points bigint not null default 0,
  games_played integer not null default 0,
  games_won integer not null default 0,
  games_lost integer not null default 0,
  win_loss_ratio double precision not null default 0,
  best_single_game integer,
  worst_single_game integer,
  elo_rating double precision not null default 1500,
  elo_peak double precision not null default 1500,
  elo_rank integer not null default 0,
  points_rank integer not null default 0,
  last5_elo_delta double precision not null default 0,
  playoff_seed_score double precision,
  recent_elo_deltas double precision[] not null default '{}',
  skill_mu double precision not null default 25,
  skill_sigma double precision not null default 8.333333333333334,
  skill_rating integer not null default 1500,
  skill_peak integer not null default 1500,
  skill_games_played integer not null default 0,
  skill_rank integer not null default 0,
  last5_skill_delta integer not null default 0,
  recent_skill_deltas integer[] not null default '{}',
  days_attended integer not null default 0,
  last_played_at date,
  updated_at timestamptz not null default now(),
  primary key (club_id, player_id)
);

create table public.season_player_stats (
  club_id text not null references public.clubs(id) on delete cascade,
  season_number integer not null,
  player_id text not null references public.players(id) on delete cascade,
  total_points bigint not null default 0,
  games_played integer not null default 0,
  games_won integer not null default 0,
  games_lost integer not null default 0,
  win_loss_ratio double precision not null default 0,
  best_single_game integer,
  worst_single_game integer,
  elo_rating double precision not null default 1500,
  elo_peak double precision not null default 1500,
  elo_rank integer not null default 0,
  points_rank integer not null default 0,
  last5_elo_delta double precision not null default 0,
  playoff_seed_score double precision,
  recent_elo_deltas double precision[] not null default '{}',
  skill_mu double precision not null default 25,
  skill_sigma double precision not null default 8.333333333333334,
  skill_rating integer not null default 1500,
  skill_peak integer not null default 1500,
  skill_games_played integer not null default 0,
  skill_rank integer not null default 0,
  last5_skill_delta integer not null default 0,
  recent_skill_deltas integer[] not null default '{}',
  days_attended integer not null default 0,
  last_played_at date,
  updated_at timestamptz not null default now(),
  primary key (club_id, season_number, player_id),
  foreign key (club_id, season_number) references public.seasons(club_id, season_number) on delete cascade
);
create index season_stats_rank_idx on public.season_player_stats(club_id, season_number, points_rank);

create table public.elo_events (
  id text primary key default encode(gen_random_bytes(10), 'hex'),
  club_id text not null references public.clubs(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  occurred_at timestamptz not null,
  season_number integer not null default 1,
  rating_before double precision not null,
  rating_after double precision not null,
  delta double precision not null,
  k_factor double precision not null,
  margin_multiplier double precision not null,
  opponents jsonb not null default '[]'::jsonb,
  unique (game_id, player_id)
);
create index elo_events_club_season_time_idx on public.elo_events(club_id, season_number, occurred_at desc);

create table public.skill_events (
  id text primary key,
  club_id text not null references public.clubs(id) on delete cascade,
  game_id text not null references public.games(id) on delete cascade,
  player_id text not null references public.players(id) on delete cascade,
  occurred_at timestamptz not null,
  season_number integer not null,
  rating_before integer not null,
  rating_after integer not null,
  delta integer not null,
  mu double precision not null,
  sigma double precision not null,
  unique(game_id, player_id)
);
create index skill_events_club_season_time_idx on public.skill_events(club_id, season_number, occurred_at desc);

create table public.sessions (
  id text primary key default encode(gen_random_bytes(10), 'hex'),
  club_id text not null references public.clubs(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by text not null,
  season_number integer not null default 1,
  is_active boolean not null default true,
  table_count integer not null check (table_count > 0),
  participants text[] not null default '{}',
  tables jsonb not null default '{}'::jsonb,
  sideline text[] not null default '{}',
  closed_at timestamptz
);
create unique index one_active_session_per_club on public.sessions(club_id) where is_active;
create index sessions_club_created_idx on public.sessions(club_id, created_at desc);

create table public.table_arrangements (
  id text primary key default encode(gen_random_bytes(10), 'hex'),
  club_id text not null references public.clubs(id) on delete cascade,
  created_at timestamptz not null default now(),
  tables jsonb not null default '{}'::jsonb,
  sideline text[] not null default '{}'
);
create index arrangements_club_created_idx on public.table_arrangements(club_id, created_at desc);

create table public.pending_manager_grants (
  id text primary key,
  club_id text not null references public.clubs(id) on delete cascade,
  club_name text not null,
  email_normalized text not null,
  status text not null check (status in ('pending', 'applied')),
  requested_by text not null,
  requested_at timestamptz not null default now(),
  applied_at timestamptz,
  applied_to_uid text
);
create index manager_grants_email_status_idx on public.pending_manager_grants(email_normalized, status);

create view public.games_with_entries with (security_invoker = true) as
select g.*,
  coalesce(jsonb_agg(jsonb_build_object('player_id', e.player_id, 'score', e.score) order by e.player_id)
    filter (where e.player_id is not null), '[]'::jsonb) as entries
from public.games g left join public.game_entries e on e.game_id = g.id
group by g.id;

create view public.user_clubs with (security_invoker = true) as
select m.*, c.name as club_name, c.active_season_number, c.active as club_active
from public.club_members m join public.clubs c on c.id = m.club_id;

alter table public.clubs enable row level security;
alter table public.user_profiles enable row level security;
alter table public.club_members enable row level security;
alter table public.join_requests enable row level security;
alter table public.players enable row level security;
alter table public.seasons enable row level security;
alter table public.app_configs enable row level security;
alter table public.games enable row level security;
alter table public.game_entries enable row level security;
alter table public.player_stats enable row level security;
alter table public.season_player_stats enable row level security;
alter table public.elo_events enable row level security;
alter table public.skill_events enable row level security;
alter table public.sessions enable row level security;
alter table public.table_arrangements enable row level security;
alter table public.pending_manager_grants enable row level security;

create policy clubs_read on public.clubs for select to authenticated using (true);
create policy clubs_create on public.clubs for insert to authenticated with check (manager_uid = public.firebase_uid());
create policy clubs_manage on public.clubs for update to authenticated using (public.is_club_manager(id)) with check (public.is_club_manager(id));
create policy own_profile on public.user_profiles for all to authenticated using (firebase_uid = public.firebase_uid()) with check (firebase_uid = public.firebase_uid());
create policy members_read on public.club_members for select to authenticated using (firebase_uid = public.firebase_uid() or public.is_club_member(club_id));
create policy members_create on public.club_members for insert to authenticated with check (firebase_uid = public.firebase_uid() or public.is_club_manager(club_id));
create policy members_update on public.club_members for update to authenticated using (firebase_uid = public.firebase_uid() or public.is_club_manager(club_id));
create policy requests_read on public.join_requests for select to authenticated using (firebase_uid = public.firebase_uid() or public.is_club_manager(club_id));
create policy requests_create on public.join_requests for insert to authenticated with check (firebase_uid = public.firebase_uid());
create policy requests_manage on public.join_requests for update to authenticated using (firebase_uid = public.firebase_uid() or public.is_club_manager(club_id));
create policy players_read on public.players for select to authenticated using (public.is_club_member(club_id));
create policy seasons_read on public.seasons for select to authenticated using (public.is_club_member(club_id));
create policy seasons_manage on public.seasons for all to authenticated using (public.is_club_manager(club_id)) with check (public.is_club_manager(club_id));
create policy config_read on public.app_configs for select to authenticated using (public.is_club_member(club_id));
create policy config_manage on public.app_configs for all to authenticated using (public.is_club_manager(club_id)) with check (public.is_club_manager(club_id));
create policy games_read on public.games for select to authenticated using (public.is_club_member(club_id));
create policy entries_read on public.game_entries for select to authenticated using (exists (select 1 from public.games g where g.id = game_id and public.is_club_member(g.club_id)));
create policy stats_read on public.player_stats for select to authenticated using (public.is_club_member(club_id));
create policy season_stats_read on public.season_player_stats for select to authenticated using (public.is_club_member(club_id));
create policy elo_read on public.elo_events for select to authenticated using (public.is_club_member(club_id));
create policy skill_events_read on public.skill_events for select to authenticated using (public.is_club_member(club_id));
create policy sessions_read on public.sessions for select to authenticated using (public.is_club_member(club_id));
create policy sessions_write on public.sessions for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));
create policy arrangements_read on public.table_arrangements for select to authenticated using (public.is_club_member(club_id));
create policy arrangements_write on public.table_arrangements for all to authenticated using (public.is_club_member(club_id)) with check (public.is_club_member(club_id));
create policy grants_manager_read on public.pending_manager_grants for select to authenticated using (public.is_club_manager(club_id));

do $$
begin
  alter publication supabase_realtime add table public.players;
  alter publication supabase_realtime add table public.club_members;
  alter publication supabase_realtime add table public.player_stats;
  alter publication supabase_realtime add table public.season_player_stats;
  alter publication supabase_realtime add table public.sessions;
  alter publication supabase_realtime add table public.games;
exception when duplicate_object then null;
end $$;

commit;
