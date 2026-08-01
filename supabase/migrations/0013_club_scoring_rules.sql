begin;

alter table public.app_configs
  add column if not exists scoring_min_fan integer not null default 3,
  add column if not exists scoring_max_fan integer not null default 13,
  add column if not exists fan_points jsonb not null default
    '{"3":8,"4":16,"5":24,"6":32,"7":48,"8":64,"9":96,"10":128,"11":192,"12":256,"13":384}'::jsonb;

alter table public.app_configs
  drop constraint if exists app_configs_scoring_fan_range_check;

alter table public.app_configs
  add constraint app_configs_scoring_fan_range_check check (
    scoring_min_fan between 1 and 30
    and scoring_max_fan between scoring_min_fan and 30
  );

commit;
