import 'server-only'

import type { PoolClient } from 'pg'
import {
  normalizeSessionPointHours,
  normalizeSessionPointWindow,
  sessionWindowPhrase,
  type SessionPointWindow,
  type SessionPointWindowHours,
} from '@/lib/session-point-window'

export type { SessionPointWindow, SessionPointWindowHours }
export {
  normalizeSessionPointHours,
  normalizeSessionPointWindow,
  sessionWindowPhrase,
}

export type SessionPointTotal = {
  playerId: string
  displayName: string
  icon: string
  netPoints: number
  games: number
}

export type SessionPointGameRow = {
  gameId: string
  playedAt: string
  score: number
  winType: string | null
  tableId: string | null
  fan: number | null
  opponents: string
}

function windowFilterSql(window: SessionPointWindow, paramOffset: number) {
  if (window.mode === 'hours') {
    return {
      clause: `g.played_at >= now() - make_interval(hours => $${paramOffset})`,
      params: [window.hours] as unknown[],
    }
  }
  return {
    clause: `g.played_at >= $${paramOffset}::timestamptz and g.played_at < $${paramOffset + 1}::timestamptz`,
    params: [window.startAt, window.endAt] as unknown[],
  }
}

export async function loadSessionPointTotals(
  db: PoolClient,
  clubId: string,
  window: SessionPointWindow,
): Promise<SessionPointTotal[]> {
  const normalizedClub = clubId.trim().toUpperCase()
  const filter = windowFilterSql(window, 2)
  // Sum only game_entries from games inside the window — this is net change
  // for the period, not the player's all-time / season standing.
  const rows = await db.query(
    `select p.id as player_id,
            p.display_name,
            p.icon,
            coalesce(windowed.net_points, 0)::int as net_points,
            coalesce(windowed.games, 0)::int as games
     from players p
     left join (
       select ge.player_id,
              sum(ge.score)::int as net_points,
              count(distinct g.id)::int as games
       from games g
       join game_entries ge on ge.game_id = g.id
       where g.club_id = $1
         and ${filter.clause}
       group by ge.player_id
     ) windowed on windowed.player_id = p.id
     where p.club_id = $1
       and p.active
     order by net_points desc, p.display_name asc`,
    [normalizedClub, ...filter.params],
  )

  return rows.rows.map((row) => ({
    playerId: String(row.player_id),
    displayName: String(row.display_name),
    icon: String(row.icon),
    netPoints: Number(row.net_points),
    games: Number(row.games),
  }))
}

export async function loadSessionPointBreakdown(
  db: PoolClient,
  clubId: string,
  playerId: string,
  window: SessionPointWindow,
): Promise<SessionPointGameRow[]> {
  const normalizedClub = clubId.trim().toUpperCase()
  const filter = windowFilterSql(window, 3)
  const rows = await db.query(
    `select g.id as game_id,
            g.played_at,
            g.win_type,
            g.table_id,
            g.fan,
            ge.score,
            coalesce((
              select string_agg(p.display_name, ', ' order by p.display_name)
              from game_entries other
              join players p on p.id = other.player_id
              where other.game_id = g.id
                and other.player_id <> ge.player_id
            ), '') as opponents
     from games g
     join game_entries ge on ge.game_id = g.id and ge.player_id = $2
     where g.club_id = $1
       and ${filter.clause}
       and exists (
         select 1 from players p
         where p.club_id = $1 and p.id = $2 and p.active
       )
     order by g.played_at desc, g.id desc`,
    [normalizedClub, playerId, ...filter.params],
  )

  return rows.rows.map((row) => ({
    gameId: String(row.game_id),
    playedAt: new Date(row.played_at).toISOString(),
    score: Number(row.score),
    winType: row.win_type ? String(row.win_type) : null,
    tableId: row.table_id ? String(row.table_id) : null,
    fan: row.fan == null ? null : Number(row.fan),
    opponents: String(row.opponents ?? ''),
  }))
}
