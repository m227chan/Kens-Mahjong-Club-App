alter table public.seasons
  add column if not exists editable_until timestamptz;

update public.seasons
set editable_until = created_at + interval '48 hours'
where competition_type = 'tournament'
  and editable_until is null;

-- Legacy tournament creation made the tournament current. Restore each affected
-- club to its newest regular season before enforcing the one-active-season rule.
with replacements as (
  select c.id,
    (select max(s.season_number) from public.seasons s where s.club_id=c.id and s.competition_type='season') season_number
  from public.clubs c
  where exists (
    select 1 from public.seasons current_competition
    where current_competition.club_id = c.id
      and current_competition.season_number = c.active_season_number
      and current_competition.competition_type = 'tournament'
  )
)
update public.clubs c
set active_season_number = replacements.season_number
from replacements
where c.id = replacements.id and replacements.season_number is not null;

-- Repair any legacy duplicate flags from before the database enforced this rule.
update public.seasons s
set active = (
  s.competition_type = 'season'
  and s.season_number = c.active_season_number
)
from public.clubs c
where c.id = s.club_id;

alter table public.seasons
  drop constraint if exists seasons_active_regular_only_check;

alter table public.seasons
  add constraint seasons_active_regular_only_check
  check (not active or competition_type = 'season');

create unique index if not exists one_active_season_per_club
  on public.seasons(club_id)
  where active and competition_type = 'season';

create or replace function public.is_competition_editable(
  target_club_id text,
  target_season_number integer
) returns boolean
language sql stable security definer set search_path = public
return exists (
  select 1
  from public.seasons s
  where s.club_id = target_club_id
    and s.season_number = target_season_number
    and (
      s.active
      or (
        s.competition_type = 'tournament'
        and s.editable_until is not null
        and s.editable_until > now()
      )
    )
);

drop policy if exists sessions_write on public.sessions;
create policy sessions_write on public.sessions for all to authenticated
using (public.is_club_member(club_id))
with check (
  public.is_club_member(club_id)
  and (
    not is_active
    or public.is_competition_editable(club_id, season_number)
  )
);
