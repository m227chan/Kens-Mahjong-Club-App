begin;

alter table public.app_configs
  alter column title_bands set default '{
    "mode":"proportion",
    "bands":[
      {"id":"messiah","title":"Messiah","value":4},
      {"id":"master","title":"Master","value":7},
      {"id":"musketeer","title":"Musketeer","value":12},
      {"id":"marshal","title":"Marshal","value":17},
      {"id":"monk","title":"Monk","value":20},
      {"id":"mortal","title":"Mortal","value":17},
      {"id":"minion","title":"Minion","value":12},
      {"id":"mongrel","title":"Mongrel","value":7},
      {"id":"moron","title":"Moron","value":4}
    ]
  }'::jsonb;

update public.app_configs
set title_bands = '{
  "mode":"proportion",
  "bands":[
    {"id":"messiah","title":"Messiah","value":4},
    {"id":"master","title":"Master","value":7},
    {"id":"musketeer","title":"Musketeer","value":12},
    {"id":"marshal","title":"Marshal","value":17},
    {"id":"monk","title":"Monk","value":20},
    {"id":"mortal","title":"Mortal","value":17},
    {"id":"minion","title":"Minion","value":12},
    {"id":"mongrel","title":"Mongrel","value":7},
    {"id":"moron","title":"Moron","value":4}
  ]
}'::jsonb
where jsonb_typeof(title_bands) <> 'object'
   or not (title_bands ? 'mode')
   or not (title_bands ? 'bands');

alter table public.app_configs
  drop constraint if exists app_configs_title_bands_shape_check;

alter table public.app_configs
  add constraint app_configs_title_bands_shape_check check (
    jsonb_typeof(title_bands) = 'object'
    and title_bands ? 'mode'
    and title_bands ? 'bands'
    and jsonb_typeof(title_bands->'bands') = 'array'
  );

commit;
