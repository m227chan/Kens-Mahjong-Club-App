begin;

-- Keep the identifiers long enough to remove audit rows after cascades run.
create temporary table deleted_club_cleanup_ids on commit drop as
select id as club_id
from public.clubs
where not active and not universal;

create temporary table deleted_club_cleanup_game_ids on commit drop as
select g.id as game_id
from public.games g
join deleted_club_cleanup_ids d on d.club_id = g.club_id;

delete from public.game_entries e
using deleted_club_cleanup_game_ids d
where e.game_id = d.game_id;

delete from public.games g
using deleted_club_cleanup_ids d
where g.club_id = d.club_id;

delete from public.clubs c
using deleted_club_cleanup_ids d
where c.id = d.club_id;

delete from public.game_audit_log a
where a.club_id in (select club_id from deleted_club_cleanup_ids)
   or (
     a.table_name = 'games'
     and a.row_id in (select game_id from deleted_club_cleanup_game_ids)
   )
   or (
     a.table_name = 'game_entries'
     and split_part(a.row_id, ':', 1) in (
       select game_id from deleted_club_cleanup_game_ids
     )
   );

create or replace function public.delete_club_permanently(target_club_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uid text := nullif(current_setting('app.actor_uid', true), '');
  target_game_ids text[];
begin
  if not exists (
    select 1
    from public.clubs c
    join public.club_members m on m.club_id = c.id
    where c.id = target_club_id
      and c.active
      and not c.universal
      and m.firebase_uid = actor_uid
      and m.active
      and m.role = 'manager'
  ) then
    raise exception 'Only an active club manager can delete a non-universal club.';
  end if;

  select coalesce(array_agg(id), '{}'::text[])
  into target_game_ids
  from public.games
  where club_id = target_club_id;

  -- Delete games explicitly so their audit rows can be identified and removed.
  delete from public.game_entries where game_id = any(target_game_ids);
  delete from public.games where club_id = target_club_id;
  delete from public.clubs where id = target_club_id;

  delete from public.game_audit_log a
  where a.club_id = target_club_id
     or (a.table_name = 'games' and a.row_id = any(target_game_ids))
     or (
       a.table_name = 'game_entries'
       and split_part(a.row_id, ':', 1) = any(target_game_ids)
     );
end;
$$;

revoke all on function public.delete_club_permanently(text)
from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_runtime') then
    execute 'grant execute on function public.delete_club_permanently(text) to app_runtime';
  end if;
end
$$;

create or replace function public.enforce_created_club_limit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.manager_uid <> 'universal' then
    perform pg_advisory_xact_lock(hashtext('club-create:' || new.manager_uid));
    if (
      select count(distinct id)
      from public.clubs
      where manager_uid = new.manager_uid and active
    ) >= 6 then
      raise exception 'You have reached the limit of 6 clubs created. You can still join or manage existing clubs.';
    end if;
  end if;
  return new;
end;
$$;

commit;
