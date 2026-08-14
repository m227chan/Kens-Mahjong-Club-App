import type { GameDoc, PlayerDoc, PlayerStatsDoc } from '@/lib/types'

export type StandingsDatePreset = 'all' | '30d' | '3m' | 'ytd' | 'custom'

export interface DateBounds {
  start: Date | null
  end: Date | null
}

export interface AggregatedPlayerGameStats {
  playerId: string
  totalPoints: number
  gamesPlayed: number
  gamesWon: number
  gamesLost: number
  selfDrawWins: number
  discardWins: number
  draws: number
  lastPlayedAt: Date | null
  pointTrend: number[]
}

export function subtractCalendarMonths(date: Date, months: number) {
  const result = new Date(date)
  const originalDay = result.getDate()
  result.setDate(1)
  result.setMonth(result.getMonth() - months)
  const lastDay = new Date(result.getFullYear(), result.getMonth() + 1, 0).getDate()
  result.setDate(Math.min(originalDay, lastDay))
  return result
}

export function boundsForPreset(
  preset: StandingsDatePreset,
  now = new Date(),
  customStart?: string,
  customEnd?: string,
): DateBounds {
  const endOfToday = new Date(now)
  endOfToday.setHours(23, 59, 59, 999)
  if (preset === 'all') return { start: null, end: null }
  if (preset === '30d') return { start: new Date(now.getTime() - 30 * 86_400_000), end: endOfToday }
  if (preset === '3m') return { start: subtractCalendarMonths(now, 3), end: endOfToday }
  if (preset === 'ytd') return { start: new Date(now.getFullYear(), 0, 1), end: endOfToday }

  const start = customStart ? new Date(`${customStart}T00:00:00`) : null
  const end = customEnd ? new Date(`${customEnd}T23:59:59.999`) : null
  return {
    start: start && Number.isFinite(start.getTime()) ? start : null,
    end: end && Number.isFinite(end.getTime()) ? end : null,
  }
}

export function gameDate(game: GameDoc) {
  return game.datetime?.toDate?.() ?? new Date(0)
}

export function gamesInBounds(games: GameDoc[], bounds: DateBounds) {
  return games.filter((game) => {
    const time = gameDate(game).getTime()
    return (!bounds.start || time >= bounds.start.getTime()) && (!bounds.end || time <= bounds.end.getTime())
  })
}

export function aggregatePlayerGames(games: GameDoc[], trendLength = 10) {
  const rows = new Map<string, AggregatedPlayerGameStats>()
  const ordered = [...games].sort((a, b) => gameDate(a).getTime() - gameDate(b).getTime())

  ordered.forEach((game) => {
    const playedAt = gameDate(game)
    game.entries.forEach((entry) => {
      const row = rows.get(entry.playerId) ?? {
        playerId: entry.playerId,
        totalPoints: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        selfDrawWins: 0,
        discardWins: 0,
        draws: 0,
        lastPlayedAt: null,
        pointTrend: [],
      }
      row.totalPoints += entry.score
      row.gamesPlayed += 1
      row.lastPlayedAt = playedAt
      if (game.winType === 'draw') row.draws += 1
      else if (game.winnerPlayerId === entry.playerId) {
        row.gamesWon += 1
        if (game.winType === 'self_draw') row.selfDrawWins += 1
        if (game.winType === 'discard') row.discardWins += 1
      } else row.gamesLost += 1
      row.pointTrend.push(row.totalPoints)
      row.pointTrend = row.pointTrend.slice(-trendLength)
      rows.set(entry.playerId, row)
    })
  })

  return rows
}

export function activePlayerIds(games: GameDoc[], months: number, now = new Date()) {
  const cutoff = subtractCalendarMonths(now, months).getTime()
  return new Set(
    games.flatMap((game) => gameDate(game).getTime() >= cutoff ? game.entries.map((entry) => entry.playerId) : []),
  )
}

export function competitionRanks<T>(rows: T[], value: (row: T) => number) {
  const result = new Map<T, number>()
  let prior: number | undefined
  let rank = 1
  ;[...rows].sort((a, b) => value(b) - value(a)).forEach((row, index) => {
    const current = value(row)
    if (prior === undefined || current !== prior) rank = index + 1
    result.set(row, rank)
    prior = current
  })
  return result
}

export function defaultComparedPlayerIds(
  players: PlayerDoc[],
  stats: PlayerStatsDoc[],
  linkedPlayerId: string | null,
  limit = 5,
) {
  const statsByPlayer = new Map(stats.map((stat) => [stat.playerId, stat]))
  const rankedPlayers = [...players].sort((left, right) => {
    const leftStats = statsByPlayer.get(left.id)
    const rightStats = statsByPlayer.get(right.id)
    if (leftStats && rightStats)
      return rightStats.skillRating - leftStats.skillRating || left.displayName.localeCompare(right.displayName)
    if (leftStats) return -1
    if (rightStats) return 1
    return left.displayName.localeCompare(right.displayName)
  })
  const linkedId = linkedPlayerId && players.some((player) => player.id === linkedPlayerId)
    ? linkedPlayerId
    : null

  return [
    ...(linkedId ? [linkedId] : []),
    ...rankedPlayers.map((player) => player.id).filter((id) => id !== linkedId),
  ].slice(0, limit)
}

export function toggleComparedPlayerId(
  selectedIds: string[],
  playerId: string,
  limit = 5,
) {
  if (selectedIds.includes(playerId))
    return selectedIds.filter((id) => id !== playerId)
  if (selectedIds.length >= limit) return selectedIds
  return [...selectedIds, playerId]
}
