begin;

-- Every active, non-universal club is deletable by one of its active managers.
-- The universal flag is the sole club-level deletion protection; names and IDs
-- intentionally have no special meaning here.
create or replace function public.delete_club_permanently(target_club_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uid text := nullif(current_setting('app.actor_uid', true), '');
  target_is_universal boolean;
  target_game_ids text[];
begin
  select c.universal
  into target_is_universal
  from public.clubs c
  where c.id = target_club_id
    and c.active;

  if not found then
    raise exception 'Club not found or inactive.';
  end if;

  if target_is_universal then
    raise exception 'The universal club cannot be deleted.';
  end if;

  if not exists (
    select 1
    from public.club_members m
    where m.club_id = target_club_id
      and m.firebase_uid = actor_uid
      and m.active
      and m.role = 'manager'
  ) then
    raise exception 'Only an active club manager can delete this club.';
  end if;

  select coalesce(array_agg(id), '{}'::text[])
  into target_game_ids
  from public.games
  where club_id = target_club_id;

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

commit;
