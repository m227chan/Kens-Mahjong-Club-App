alter table public.seasons
  add column if not exists competition_type text not null default 'season';

alter table public.seasons
  drop constraint if exists seasons_competition_type_check;

alter table public.seasons
  add constraint seasons_competition_type_check
  check (competition_type in ('season', 'tournament'));

create index if not exists seasons_club_competition_type_idx
  on public.seasons(club_id, competition_type, season_number);
