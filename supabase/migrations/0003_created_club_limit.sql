begin;

create or replace function public.enforce_created_club_limit() returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.manager_uid <> 'universal' then
    perform pg_advisory_xact_lock(hashtext('club-create:' || new.manager_uid));
    if (select count(distinct id) from public.clubs where manager_uid = new.manager_uid) >= 6 then
      raise exception 'You have reached the limit of 6 clubs created. You can still join or manage existing clubs.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists clubs_created_limit_before_insert on public.clubs;
create trigger clubs_created_limit_before_insert
before insert on public.clubs
for each row execute function public.enforce_created_club_limit();

commit;
