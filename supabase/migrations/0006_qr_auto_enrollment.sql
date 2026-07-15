begin;

alter table public.clubs
  add column if not exists qr_auto_enroll boolean not null default true;

commit;
