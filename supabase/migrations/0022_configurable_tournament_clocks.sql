alter table public.seasons
  add column if not exists tournament_duration_hours integer;

-- Existing tournaments were created with a 48-hour clock. Preserve that
-- configuration; newly created tournaments use the 24-hour application default.
update public.seasons
set tournament_duration_hours = 48
where competition_type = 'tournament'
  and tournament_duration_hours is null;

alter table public.seasons
  drop constraint if exists seasons_tournament_duration_hours_check;

alter table public.seasons
  add constraint seasons_tournament_duration_hours_check
  check (
    (competition_type = 'season' and tournament_duration_hours is null)
    or
    (competition_type = 'tournament' and tournament_duration_hours between 1 and 720)
  );

alter table public.seasons
  drop constraint if exists seasons_tournament_seconds_remaining_check;

alter table public.seasons
  add constraint seasons_tournament_seconds_remaining_check
  check (
    tournament_seconds_remaining is null
    or tournament_seconds_remaining between 0 and 2592000
  );
