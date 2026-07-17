begin;

create or replace function public.delete_user_data_safely(
  target_uid text,
  manager_resolutions jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor_uid text := nullif(current_setting('app.actor_uid', true), '');
  sole_club record;
  resolution jsonb;
  resolution_action text;
  successor_uid text;
  successor record;
begin
  if actor_uid is null or actor_uid <> target_uid then
    raise exception 'You can only delete your own account.';
  end if;

  perform pg_advisory_xact_lock(hashtext('account-delete:' || target_uid));

  for sole_club in
    select c.id, c.name, c.universal
    from public.clubs c
    join public.club_members own
      on own.club_id = c.id
     and own.firebase_uid = target_uid
     and own.active
     and own.role = 'manager'
    where c.active
      and not exists (
        select 1 from public.club_members other_manager
        where other_manager.club_id = c.id
          and other_manager.firebase_uid <> target_uid
          and other_manager.active
          and other_manager.role = 'manager'
      )
    order by c.id
    for update of c
  loop
    resolution := manager_resolutions -> sole_club.id;
    resolution_action := resolution ->> 'action';
    successor_uid := nullif(resolution ->> 'successorUid', '');

    if resolution_action = 'delete' then
      if sole_club.universal then
        raise exception 'The universal club must be assigned to another manager.';
      end if;
      perform public.delete_club_permanently(sole_club.id);
    elsif resolution_action = 'transfer' then
      select m.firebase_uid, m.email, m.display_name
      into successor
      from public.club_members m
      where m.club_id = sole_club.id
        and m.firebase_uid = successor_uid
        and m.firebase_uid <> target_uid
        and m.active;

      if not found then
        raise exception 'Choose an active member of % as its new manager.', sole_club.name;
      end if;

      update public.club_members
      set role = 'manager'
      where club_id = sole_club.id and firebase_uid = successor.firebase_uid;

      update public.clubs
      set manager_uid = successor.firebase_uid,
          manager_email = successor.email,
          manager_display_name = successor.display_name
      where id = sole_club.id;
    else
      raise exception 'Choose a manager handoff or club deletion for %.', sole_club.name;
    end if;
  end loop;

  if exists (
    select 1
    from public.clubs c
    join public.club_members own
      on own.club_id = c.id
     and own.firebase_uid = target_uid
     and own.active
     and own.role = 'manager'
    where c.active
      and not exists (
        select 1 from public.club_members other_manager
        where other_manager.club_id = c.id
          and other_manager.firebase_uid <> target_uid
          and other_manager.active
          and other_manager.role = 'manager'
      )
  ) then
    raise exception 'Every managed club needs another manager before account deletion.';
  end if;

  for sole_club in
    select c.id from public.clubs c
    where c.active and c.manager_uid = target_uid
  loop
    select m.firebase_uid, m.email, m.display_name
    into successor
    from public.club_members m
    where m.club_id = sole_club.id
      and m.firebase_uid <> target_uid
      and m.active
      and m.role = 'manager'
    order by m.joined_at, m.firebase_uid
    limit 1;

    if found then
      update public.clubs
      set manager_uid = successor.firebase_uid,
          manager_email = successor.email,
          manager_display_name = successor.display_name
      where id = sole_club.id;
    end if;
  end loop;

  if exists (
    select 1 from public.clubs
    where active and manager_uid = target_uid
  ) then
    raise exception 'A club ownership record could not be transferred safely.';
  end if;

  update public.players set auth_uid = null where auth_uid = target_uid;
  update public.games set created_by = 'deleted-user' where created_by = target_uid;
  update public.seasons set created_by = 'deleted-user' where created_by = target_uid;
  update public.sessions set created_by = 'deleted-user' where created_by = target_uid;
  update public.join_requests set resolved_by = null where resolved_by = target_uid;
  delete from public.join_requests where firebase_uid = target_uid;
  delete from public.pending_manager_grants where applied_to_uid = target_uid;
  update public.pending_manager_grants
  set requested_by = 'deleted-user'
  where requested_by = target_uid;
  update public.clubs set deleted_by = null where deleted_by = target_uid;

  update public.game_audit_log a
  set actor_uid = case when a.actor_uid = target_uid then null else a.actor_uid end,
      old_row = case
        when old_row ->> 'created_by' = target_uid
          then jsonb_set(old_row, '{created_by}', '"deleted-user"'::jsonb)
        else old_row
      end,
      new_row = case
        when new_row ->> 'created_by' = target_uid
          then jsonb_set(new_row, '{created_by}', '"deleted-user"'::jsonb)
        else new_row
      end
  where a.actor_uid = target_uid
     or old_row ->> 'created_by' = target_uid
     or new_row ->> 'created_by' = target_uid;

  delete from public.club_members where firebase_uid = target_uid;
  delete from public.user_profiles where firebase_uid = target_uid;
end;
$$;

revoke all on function public.delete_user_data_safely(text, jsonb)
from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'app_runtime') then
    execute 'grant execute on function public.delete_user_data_safely(text, jsonb) to app_runtime';
  end if;
end
$$;

commit;
