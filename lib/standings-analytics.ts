import type { GameDoc, PlayerDoc, PlayerStatsDoc, SkillEventDoc } from '@/lib/types'
import { calculateSkillRound, initialSkillState } from '@/lib/skill-rating'

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

export interface PlayerCompetitionRecords {
  maximumCumulativePoints: number | null
  minimumCumulativePoints: number | null
  highestSingleGameWin: number | null
  worstSingleGameLoss: number | null
  peakSkillRating: number | null
  lowestSkillRating: number | null
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

export function combinedCompetitionSkillEvents(games: GameDoc[]): SkillEventDoc[] {
  const states = new Map<string, ReturnType<typeof initialSkillState>>()
  const events: SkillEventDoc[] = []
  const ordered = [...games].sort((left, right) =>
    gameDate(left).getTime() - gameDate(right).getTime() || left.id.localeCompare(right.id),
  )

  ordered.forEach((game) => {
    const results = calculateSkillRound(game.entries.map((entry) => ({
      ...entry,
      ...(states.get(entry.playerId) ?? initialSkillState()),
    })))
    results.forEach((result) => {
      states.set(result.playerId, {
        mu: result.mu,
        sigma: result.sigma,
        gamesPlayed: result.gamesPlayed,
      })
      events.push({
        id: `all_${game.id}_${result.playerId}`,
        gameId: game.id,
        playerId: result.playerId,
        datetime: game.datetime,
        seasonNumber: game.seasonNumber,
        ratingBefore: result.ratingBefore,
        ratingAfter: result.ratingAfter,
        delta: result.delta,
        mu: result.mu,
        sigma: result.sigma,
      })
    })
  })

  return events
}

export function aggregateAllCompetitionStats(games: GameDoc[]): PlayerStatsDoc[] {
  const ordered = [...games].sort((left, right) =>
    gameDate(left).getTime() - gameDate(right).getTime() || left.id.localeCompare(right.id),
  )
  const skillEvents = combinedCompetitionSkillEvents(ordered)
  const skillByPlayer = new Map<string, SkillEventDoc[]>()
  skillEvents.forEach((event) => skillByPlayer.set(event.playerId, [...(skillByPlayer.get(event.playerId) ?? []), event]))
  const accumulators = new Map<string, {
    totalPoints: number
    gamesPlayed: number
    gamesWon: number
    gamesLost: number
    scores: number[]
    recentPointTrend: number[]
    attendanceDays: Set<string>
    lastGame: GameDoc
  }>()

  ordered.forEach((game) => {
    const day = gameDate(game).toISOString().slice(0, 10)
    game.entries.forEach((entry) => {
      const current = accumulators.get(entry.playerId) ?? {
        totalPoints: 0,
        gamesPlayed: 0,
        gamesWon: 0,
        gamesLost: 0,
        scores: [],
        recentPointTrend: [],
        attendanceDays: new Set<string>(),
        lastGame: game,
      }
      current.totalPoints += entry.score
      current.gamesPlayed += 1
      if (entry.score > 0) current.gamesWon += 1
      if (entry.score < 0) current.gamesLost += 1
      current.scores.push(entry.score)
      current.recentPointTrend = [...current.recentPointTrend, current.totalPoints].slice(-10)
      current.attendanceDays.add(day)
      current.lastGame = game
      accumulators.set(entry.playerId, current)
    })
  })

  const initial = initialSkillState()
  const rows = [...accumulators].map(([playerId, value]): PlayerStatsDoc => {
    const playerEvents = skillByPlayer.get(playerId) ?? []
    const latestSkill = playerEvents.at(-1)
    const recentSkillDeltas = playerEvents.slice(-5).map((event) => event.delta)
    const skillRating = latestSkill?.ratingAfter ?? 1500
    const skillPeak = playerEvents.length
      ? Math.max(...playerEvents.flatMap((event) => [event.ratingBefore, event.ratingAfter]))
      : 1500
    const lastPlayedAt = gameDate(value.lastGame).toISOString().slice(0, 10)
    return {
      id: `all_${playerId}`,
      playerId,
      totalPoints: value.totalPoints,
      gamesPlayed: value.gamesPlayed,
      gamesWon: value.gamesWon,
      gamesLost: value.gamesLost,
      winLossRatio: value.gamesWon / Math.max(1, value.gamesLost),
      bestSingleGame: Math.max(...value.scores),
      worstSingleGame: Math.min(...value.scores),
      eloRating: skillRating,
      eloPeak: skillPeak,
      eloGamesPlayed: value.gamesPlayed,
      eloRank: 0,
      pointsRank: 0,
      last5EloDelta: recentSkillDeltas.reduce((sum, delta) => sum + delta, 0),
      recentEloDeltas: recentSkillDeltas,
      skillMu: latestSkill?.mu ?? initial.mu,
      skillSigma: latestSkill?.sigma ?? initial.sigma,
      skillRating,
      skillPeak,
      skillGamesPlayed: playerEvents.length,
      skillRank: 0,
      last5SkillDelta: recentSkillDeltas.reduce((sum, delta) => sum + delta, 0),
      recentSkillDeltas,
      recentPointTrend: value.recentPointTrend,
      daysAttended: value.attendanceDays.size,
      lastPlayedAt,
      updatedAt: value.lastGame.datetime,
    }
  })
  const pointRanks = competitionRanks(rows, (row) => row.totalPoints)
  const skillRanks = competitionRanks(rows, (row) => row.skillRating)
  return rows
    .map((row) => ({
      ...row,
      eloRank: skillRanks.get(row) ?? 0,
      pointsRank: pointRanks.get(row) ?? 0,
      skillRank: skillRanks.get(row) ?? 0,
    }))
    .sort((left, right) => left.skillRank - right.skillRank || left.playerId.localeCompare(right.playerId))
}

export function playerCompetitionRecords(
  games: GameDoc[],
  skillEvents: SkillEventDoc[],
  playerId: string,
): PlayerCompetitionRecords {
  let runningPoints = 0
  const cumulativePoints: number[] = []
  const singleGameScores: number[] = []

  ;[...games]
    .sort((left, right) => gameDate(left).getTime() - gameDate(right).getTime())
    .forEach((game) => {
      const score = game.entries.find((entry) => entry.playerId === playerId)?.score
      if (score === undefined) return
      runningPoints += score
      cumulativePoints.push(runningPoints)
      singleGameScores.push(score)
    })

  const skillRatings = skillEvents
    .filter((event) => event.playerId === playerId)
    .flatMap((event) => [event.ratingBefore, event.ratingAfter])
    .filter(Number.isFinite)
  const wins = singleGameScores.filter((score) => score > 0)
  const losses = singleGameScores.filter((score) => score < 0)

  return {
    maximumCumulativePoints: cumulativePoints.length ? Math.max(...cumulativePoints) : null,
    minimumCumulativePoints: cumulativePoints.length ? Math.min(...cumulativePoints) : null,
    highestSingleGameWin: wins.length ? Math.max(...wins) : null,
    worstSingleGameLoss: losses.length ? Math.min(...losses) : null,
    peakSkillRating: skillRatings.length ? Math.max(...skillRatings) : null,
    lowestSkillRating: skillRatings.length ? Math.min(...skillRatings) : null,
  }
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
