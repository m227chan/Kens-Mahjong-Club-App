begin;

alter table public.games
  add column if not exists idempotency_key text;

create unique index if not exists games_club_idempotency_key_idx
  on public.games(club_id, idempotency_key)
  where idempotency_key is not null;

commit;
