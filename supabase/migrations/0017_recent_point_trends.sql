alter table public.player_stats
  add column if not exists recent_point_trend bigint[] not null default '{}';

alter table public.season_player_stats
  add column if not exists recent_point_trend bigint[] not null default '{}';

with running as (
  select g.club_id,
         e.player_id,
         g.played_at,
         g.id game_id,
         sum(e.score) over (
           partition by g.club_id,e.player_id
           order by g.played_at,g.id
           rows between unbounded preceding and current row
         ) running_points
    from public.games g
    join public.game_entries e on e.game_id=g.id
), ranked as (
  select *,row_number() over (
    partition by club_id,player_id order by played_at desc,game_id desc
  ) recent_rank
    from running
), trends as (
  select club_id,player_id,
         array_agg(running_points order by played_at,game_id) recent_point_trend
    from ranked
   where recent_rank <= 10
   group by club_id,player_id
)
update public.player_stats stats
   set recent_point_trend=trends.recent_point_trend
  from trends
 where stats.club_id=trends.club_id
   and stats.player_id=trends.player_id;

with running as (
  select g.club_id,
         g.season_number,
         e.player_id,
         g.played_at,
         g.id game_id,
         sum(e.score) over (
           partition by g.club_id,g.season_number,e.player_id
           order by g.played_at,g.id
           rows between unbounded preceding and current row
         ) running_points
    from public.games g
    join public.game_entries e on e.game_id=g.id
), ranked as (
  select *,row_number() over (
    partition by club_id,season_number,player_id
    order by played_at desc,game_id desc
  ) recent_rank
    from running
), trends as (
  select club_id,season_number,player_id,
         array_agg(running_points order by played_at,game_id) recent_point_trend
    from ranked
   where recent_rank <= 10
   group by club_id,season_number,player_id
)
update public.season_player_stats stats
   set recent_point_trend=trends.recent_point_trend
  from trends
 where stats.club_id=trends.club_id
   and stats.season_number=trends.season_number
   and stats.player_id=trends.player_id;

comment on column public.player_stats.recent_point_trend is
  'Latest ten cumulative point totals, maintained with player statistics.';
comment on column public.season_player_stats.recent_point_trend is
  'Latest ten cumulative point totals in this season, maintained with player statistics.';
