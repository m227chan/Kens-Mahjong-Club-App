begin;

alter table public.app_configs
  add column if not exists active_player_months integer not null default 3;

alter table public.app_configs
  drop constraint if exists app_configs_active_player_months_check;

alter table public.app_configs
  add constraint app_configs_active_player_months_check
  check (active_player_months between 1 and 36);

commit;
