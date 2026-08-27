begin;

alter table public.clubs
  add column if not exists join_approval_required boolean not null default true;

comment on column public.clubs.join_approval_required is
  'When true, club-ID joins create pending requests. When false, signed-in users with the club ID join immediately.';

commit;
