-- Prevent authenticated clients from self-joining or self-promoting via PostgREST.
-- Membership writes remain available to managers and to the server role (BYPASSRLS).

drop policy if exists members_create on public.club_members;
drop policy if exists members_update on public.club_members;

create policy members_create on public.club_members
  for insert to authenticated
  with check (public.is_club_manager(club_id));

create policy members_update on public.club_members
  for update to authenticated
  using (public.is_club_manager(club_id))
  with check (public.is_club_manager(club_id));
