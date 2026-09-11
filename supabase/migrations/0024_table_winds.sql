begin;

alter table public.sessions
  add column if not exists table_winds jsonb not null default '{}'::jsonb;

alter table public.app_configs
  add column if not exists wind_rotation_mode text not null default 'non_dealer_and_draw';

alter table public.app_configs
  drop constraint if exists app_configs_wind_rotation_mode_check;

alter table public.app_configs
  add constraint app_configs_wind_rotation_mode_check
  check (
    wind_rotation_mode in (
      'non_dealer_and_draw',
      'non_dealer_only',
      'always'
    )
  );

commit;
