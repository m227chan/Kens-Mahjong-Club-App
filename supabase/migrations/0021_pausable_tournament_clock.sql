alter table public.clubs
  add column if not exists current_competition_number integer;

alter table public.seasons
  add column if not exists tournament_seconds_remaining integer;

update public.seasons
set tournament_seconds_remaining = greatest(
  0,
  least(
    172800,
    extract(epoch from (coalesce(editable_until, created_at + interval '48 hours') - now()))::integer
  )
)
where competition_type = 'tournament'
  and tournament_seconds_remaining is null;

update public.clubs
set current_competition_number = active_season_number
where current_competition_number is null;

alter table public.seasons
  drop constraint if exists seasons_tournament_seconds_remaining_check;

alter table public.seasons
  add constraint seasons_tournament_seconds_remaining_check
  check (
    tournament_seconds_remaining is null
    or tournament_seconds_remaining between 0 and 172800
  );

create or replace function public.is_competition_editable(
  target_club_id text,
  target_season_number integer
) returns boolean
language sql stable security definer set search_path = public
return exists (
  select 1
  from public.seasons s
  join public.clubs c on c.id = s.club_id
  where s.club_id = target_club_id
    and s.season_number = target_season_number
    and (
      s.active
      or (
        s.competition_type = 'tournament'
        and c.current_competition_number = s.season_number
        and s.editable_until is not null
        and s.editable_until > now()
      )
    )
);
