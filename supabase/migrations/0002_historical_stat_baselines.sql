begin;

alter table public.games
  add column if not exists is_historical boolean not null default false;

alter table public.elo_events
  add column if not exists is_historical boolean not null default false;

alter table public.player_stats
  add column if not exists elo_games_played integer not null default 0;

alter table public.season_player_stats
  add column if not exists elo_games_played integer not null default 0;

create table if not exists public.stat_baselines (
  club_id text not null references public.clubs(id) on delete cascade,
  season_number integer not null default 0 check (season_number >= 0),
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
  elo_games_played integer not null default 0,
  last5_elo_delta double precision not null default 0,
  playoff_seed_score double precision,
  recent_elo_deltas double precision[] not null default '{}',
  days_attended integer not null default 0,
  last_played_at date,
  updated_at timestamptz not null default now(),
  primary key (club_id, season_number, player_id)
);

create index if not exists games_club_historical_played_idx
  on public.games(club_id, is_historical, played_at);

alter table public.stat_baselines enable row level security;

drop policy if exists stat_baselines_read on public.stat_baselines;
create policy stat_baselines_read on public.stat_baselines
  for select to authenticated using (public.is_club_member(club_id));

commit;
