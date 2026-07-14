import 'server-only'
import { randomBytes } from 'node:crypto'
import type { PoolClient } from 'pg'
import { toDateOnly } from '@/lib/date-only'
import { calculateRoundEloDeltas, computeGlobalRanks, type AppConfigLike } from '@/lib/stats-engine'
import { withTransaction } from '@/lib/postgres-admin'

type Entry = { playerId: string; score: number }
type GameInput = { datetime?: unknown; seasonNumber?: number; entries: Entry[]; createdBy?: string; tableId?: string | null; notes?: string | null; winType?: 'self_draw' | 'discard' | 'draw'; loserPlayerId?: string | null; fan?: number | null }
type Game = GameInput & { id: string; datetime: Date; createdBy: string; seasonNumber: number; entries: Entry[]; winnerPlayerId: string | null; isHistorical: boolean }
type Stats = { playerId: string; seasonNumber?: number; totalPoints: number; gamesPlayed: number; gamesWon: number; gamesLost: number; winLossRatio: number; bestSingleGame: number; worstSingleGame: number; eloRating: number; eloPeak: number; eloGamesPlayed: number; eloRank: number; pointsRank: number; last5EloDelta: number; playoffSeedScore: number | null; recentEloDeltas: number[]; daysAttended: number; lastPlayedAt: string | null }

const KEN_STATS_CUTOFF = Date.parse('2026-04-25T04:00:00.000Z')
const id = () => randomBytes(10).toString('hex')

function dateOf(value: unknown) {
  if (value && typeof value === 'object' && 'seconds' in value) return new Date(Number((value as { seconds: number }).seconds) * 1000)
  const date = value ? new Date(value as string | number) : new Date()
  if (!Number.isFinite(date.getTime())) throw new Error('Enter a valid game date and time.')
  return date
}

function validate(entries: Entry[]) {
  if (entries.length < 2 || entries.length > 4 || new Set(entries.map((entry) => entry.playerId)).size !== entries.length) throw new Error('A game must contain two to four different players.')
  if (entries.some((entry) => !entry.playerId || !Number.isFinite(Number(entry.score)))) throw new Error('Every score must be a valid number.')
  if (entries.reduce((sum, entry) => sum + Number(entry.score), 0) !== 0) throw new Error('Game scores must add up to zero.')
}

async function requireAccess(client: PoolClient, clubId: string, uid: string, managerOnly: boolean) {
  const result = await client.query('select role from club_members where club_id=$1 and firebase_uid=$2 and active=true', [clubId, uid])
  if (!result.rowCount || (managerOnly && result.rows[0].role !== 'manager')) throw new Error(managerOnly ? 'Only an active club manager can modify game records.' : 'Only an active club member can record games.')
}

function resultType(entries: Entry[], requested?: GameInput['winType']): { winType: NonNullable<GameInput['winType']>; winnerPlayerId: string | null } {
  const draw = entries.every((entry) => Number(entry.score) === 0)
  const winType = draw ? 'draw' : requested === 'discard' ? 'discard' : 'self_draw'
  const winnerPlayerId = draw ? null : entries.reduce((best, entry) => Number(entry.score) > Number(best.score) ? entry : best).playerId
  return { winType, winnerPlayerId }
}

async function insertGame(client: PoolClient, clubId: string, input: GameInput, callerUid: string) {
  const entries = input.entries.map((entry) => ({ playerId: entry.playerId, score: Number(entry.score) }))
  validate(entries)
  const gameId = id()
  const { winType, winnerPlayerId } = resultType(entries, input.winType)
  if (winType === 'discard' && !input.loserPlayerId) throw new Error('Discard wins require a loser.')
  await client.query(`insert into games(id,club_id,played_at,created_by,season_number,table_id,win_type,winner_player_id,loser_player_id,fan,notes,is_historical)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false)`, [gameId, clubId, dateOf(input.datetime), input.createdBy ?? callerUid, Math.max(1, Math.floor(input.seasonNumber ?? 1)), input.tableId ?? null, winType, winnerPlayerId, winType === 'discard' ? input.loserPlayerId ?? null : null, input.fan ?? null, input.notes?.trim() || null])
  for (const entry of entries) await client.query('insert into game_entries(game_id,player_id,score) values($1,$2,$3)', [gameId, entry.playerId, entry.score])
  return gameId
}

async function readGame(client: PoolClient, clubId: string, gameId?: string): Promise<Game | null> {
  if (!gameId) return null
  const result = await client.query(`select g.*, coalesce(json_agg(json_build_object('playerId',e.player_id,'score',e.score)) filter(where e.player_id is not null),'[]') entries
    from games g left join game_entries e on e.game_id=g.id where g.club_id=$1 and g.id=$2 group by g.id`, [clubId, gameId])
  const row = result.rows[0]
  return row ? { id: row.id, datetime: new Date(row.played_at), createdBy: row.created_by, seasonNumber: row.season_number, entries: row.entries,
    tableId: row.table_id, notes: row.notes, winType: row.win_type, loserPlayerId: row.loser_player_id, fan: row.fan, winnerPlayerId: row.winner_player_id, isHistorical: row.is_historical } : null
}

function countsTowardMetrics(clubId: string, game: Pick<Game, 'seasonNumber' | 'datetime'>) {
  return clubId !== 'KEN' || game.seasonNumber !== 2 || game.datetime.getTime() >= KEN_STATS_CUTOFF
}

async function adjustHistoricalBaseline(client: PoolClient, clubId: string, game: Game, direction: 1 | -1) {
  const counted = countsTowardMetrics(clubId, game)
  for (const entry of game.entries) {
    for (const seasonNumber of [0, game.seasonNumber]) {
      await client.query(`insert into stat_baselines(club_id,season_number,player_id) values($1,$2,$3)
        on conflict(club_id,season_number,player_id) do nothing`, [clubId, seasonNumber, entry.playerId])
      const points = direction * Number(entry.score)
      const games = counted ? direction : 0
      const wins = counted && entry.score > 0 ? direction : 0
      const losses = counted && entry.score < 0 ? direction : 0
      await client.query(`update stat_baselines set total_points=total_points+$1, games_played=greatest(0,games_played+$2), games_won=greatest(0,games_won+$3), games_lost=greatest(0,games_lost+$4),
        win_loss_ratio=(greatest(0,games_won+$3)::double precision / greatest(1,games_lost+$4)), updated_at=now()
        where club_id=$5 and season_number=$6 and player_id=$7`, [points, games, wins, losses, clubId, seasonNumber, entry.playerId])
    }
  }
  if (!counted) return
  for (const playerId of new Set(game.entries.map((entry) => entry.playerId))) {
    const extrema = await client.query(`select max(e.score) best, min(e.score) worst, count(distinct g.played_at::date)::int days, max(g.played_at)::date last_played
      from games g join game_entries e on e.game_id=g.id where g.club_id=$1 and g.is_historical=true and e.player_id=$2
      and ($1 <> 'KEN' or g.season_number <> 2 or g.played_at >= to_timestamp($3 / 1000.0))`, [clubId, playerId, KEN_STATS_CUTOFF])
    for (const seasonNumber of [0, game.seasonNumber]) await client.query(`update stat_baselines set best_single_game=$1,worst_single_game=$2,days_attended=$3,last_played_at=$4,updated_at=now()
      where club_id=$5 and season_number=$6 and player_id=$7`, [extrema.rows[0].best, extrema.rows[0].worst, extrema.rows[0].days, extrema.rows[0].last_played, clubId, seasonNumber, playerId])
  }
}

function baselineStats(row: Record<string, unknown>): Stats {
  return { playerId: String(row.player_id), ...(Number(row.season_number) ? { seasonNumber: Number(row.season_number) } : {}), totalPoints: Number(row.total_points), gamesPlayed: Number(row.games_played),
    gamesWon: Number(row.games_won), gamesLost: Number(row.games_lost), winLossRatio: Number(row.win_loss_ratio), bestSingleGame: row.best_single_game == null ? Number.NEGATIVE_INFINITY : Number(row.best_single_game),
    worstSingleGame: row.worst_single_game == null ? Number.POSITIVE_INFINITY : Number(row.worst_single_game), eloRating: Number(row.elo_rating), eloPeak: Number(row.elo_peak), eloGamesPlayed: Number(row.elo_games_played),
    eloRank: 0, pointsRank: 0, last5EloDelta: Number(row.last5_elo_delta), playoffSeedScore: row.playoff_seed_score == null ? null : Number(row.playoff_seed_score), recentEloDeltas: (row.recent_elo_deltas as number[]) ?? [],
    daysAttended: Number(row.days_attended), lastPlayedAt: toDateOnly(row.last_played_at) }
}

async function rebuild(client: PoolClient, clubId: string) {
  const [gameRows, configRows, baselineRows] = await Promise.all([
    client.query(`select g.*, coalesce(json_agg(json_build_object('playerId',e.player_id,'score',e.score)) filter(where e.player_id is not null),'[]') entries
      from games g left join game_entries e on e.game_id=g.id where g.club_id=$1 and g.is_historical=false group by g.id order by g.played_at,g.id`, [clubId]),
    client.query('select * from app_configs where club_id=$1', [clubId]),
    client.query('select * from stat_baselines where club_id=$1', [clubId])
  ])
  const games: Game[] = gameRows.rows.map((row) => ({ id: row.id, datetime: new Date(row.played_at), createdBy: row.created_by, seasonNumber: row.season_number,
    entries: row.entries, tableId: row.table_id, notes: row.notes, winType: row.win_type, loserPlayerId: row.loser_player_id, fan: row.fan, winnerPlayerId: row.winner_player_id, isHistorical: false }))
  const raw = configRows.rows[0] ?? {}
  const config: AppConfigLike = { eloBaseK: raw.elo_base_k, eloVeteranGamesThreshold: raw.elo_veteran_games_threshold, eloStartingRating: raw.elo_starting_rating,
    eloNewPlayerK: raw.elo_new_player_k, eloIntermediateK: raw.elo_intermediate_k, eloNewPlayerGamesThreshold: raw.elo_new_player_games_threshold }
  const start = config.eloStartingRating ?? 1500
  const make = (playerId: string, seasonNumber?: number): Stats => ({ playerId, ...(seasonNumber == null ? {} : { seasonNumber }), totalPoints: 0, gamesPlayed: 0, gamesWon: 0, gamesLost: 0, winLossRatio: 0,
    bestSingleGame: Number.NEGATIVE_INFINITY, worstSingleGame: Number.POSITIVE_INFINITY, eloRating: start, eloPeak: start, eloGamesPlayed: 0, eloRank: 0, pointsRank: 0, last5EloDelta: 0, playoffSeedScore: null,
    recentEloDeltas: [], daysAttended: 0, lastPlayedAt: null })
  const all = new Map<string, Stats>(), seasonal = new Map<string, Stats>(), events: Array<Record<string, unknown>> = []
  for (const row of baselineRows.rows) {
    const value = baselineStats(row)
    if (Number(row.season_number) === 0) all.set(value.playerId, value)
    else seasonal.set(`${row.season_number}_${value.playerId}`, value)
  }
  const apply = (map: Map<string, Stats>, keyFor: (playerId: string) => string, game: Game, seasonNumber?: number) => {
    const round = game.entries.map((entry) => { const current = map.get(keyFor(entry.playerId)) ?? make(entry.playerId, seasonNumber); return { ...entry, ratingBefore: current.eloRating, gamesPlayed: current.eloGamesPlayed } })
    const results = calculateRoundEloDeltas(round, config)
    for (const entry of game.entries) {
      const key = keyFor(entry.playerId), current = map.get(key) ?? make(entry.playerId, seasonNumber), result = results.find((item) => item.playerId === entry.playerId)!
      const day = game.datetime.toISOString().slice(0, 10), recent = [...current.recentEloDeltas, result.delta].slice(-5)
      const wins = current.gamesWon + (entry.score > 0 ? 1 : 0), losses = current.gamesLost + (entry.score < 0 ? 1 : 0)
      map.set(key, { ...current, totalPoints: current.totalPoints + entry.score, gamesPlayed: current.gamesPlayed + 1, gamesWon: wins, gamesLost: losses, winLossRatio: wins / Math.max(1, losses),
        bestSingleGame: Math.max(current.bestSingleGame, entry.score), worstSingleGame: Math.min(current.worstSingleGame, entry.score), eloRating: result.ratingAfter, eloPeak: Math.max(current.eloPeak, result.ratingAfter),
        eloGamesPlayed: current.eloGamesPlayed + 1, last5EloDelta: recent.reduce((sum, value) => sum + value, 0), recentEloDeltas: recent,
        daysAttended: current.daysAttended + (current.lastPlayedAt === day ? 0 : 1), lastPlayedAt: day })
    }
    return results
  }
  for (const game of games) {
    apply(all, (playerId) => playerId, game)
    const results = apply(seasonal, (playerId) => `${game.seasonNumber}_${playerId}`, game, game.seasonNumber)
    for (const result of results) events.push({ id: `${game.id}_${result.playerId}`, clubId, gameId: game.id, playerId: result.playerId, occurredAt: game.datetime,
      seasonNumber: game.seasonNumber, ratingBefore: result.ratingBefore, ratingAfter: result.ratingAfter, delta: result.delta, kFactor: result.kFactor, marginMultiplier: result.marginMultiplier, opponents: result.opponents })
  }
  const rank = (values: Stats[]) => { const ranks = computeGlobalRanks(values); for (const value of values) { value.eloRank = ranks.eloRanks[value.playerId] ?? 0; value.pointsRank = ranks.pointsRanks[value.playerId] ?? 0 } }
  rank([...all.values()]); for (const season of new Set([...seasonal.values()].map((value) => value.seasonNumber!))) rank([...seasonal.values()].filter((value) => value.seasonNumber === season))
  await client.query('delete from elo_events where club_id=$1 and is_historical=false', [clubId])
  await client.query('delete from season_player_stats where club_id=$1', [clubId]); await client.query('delete from player_stats where club_id=$1', [clubId])
  const insertStats = async (table: string, value: Stats) => {
    const seasonColumn = value.seasonNumber == null ? '' : 'season_number,'
    const columns = `club_id,${seasonColumn}player_id,total_points,games_played,games_won,games_lost,win_loss_ratio,best_single_game,worst_single_game,elo_rating,elo_peak,elo_games_played,elo_rank,points_rank,last5_elo_delta,playoff_seed_score,recent_elo_deltas,days_attended,last_played_at`
    const values = value.seasonNumber == null
      ? [clubId,value.playerId,value.totalPoints,value.gamesPlayed,value.gamesWon,value.gamesLost,value.winLossRatio,Number.isFinite(value.bestSingleGame)?value.bestSingleGame:null,Number.isFinite(value.worstSingleGame)?value.worstSingleGame:null,value.eloRating,value.eloPeak,value.eloGamesPlayed,value.eloRank,value.pointsRank,value.last5EloDelta,value.playoffSeedScore,value.recentEloDeltas,value.daysAttended,value.lastPlayedAt]
      : [clubId,value.seasonNumber,value.playerId,value.totalPoints,value.gamesPlayed,value.gamesWon,value.gamesLost,value.winLossRatio,Number.isFinite(value.bestSingleGame)?value.bestSingleGame:null,Number.isFinite(value.worstSingleGame)?value.worstSingleGame:null,value.eloRating,value.eloPeak,value.eloGamesPlayed,value.eloRank,value.pointsRank,value.last5EloDelta,value.playoffSeedScore,value.recentEloDeltas,value.daysAttended,value.lastPlayedAt]
    await client.query(`insert into ${table}(${columns}) values(${values.map((_, index) => `$${index + 1}`).join(',')})`, values)
  }
  for (const value of all.values()) await insertStats('player_stats', value)
  for (const value of seasonal.values()) await insertStats('season_player_stats', value)
  for (const event of events) await client.query(`insert into elo_events(id,club_id,game_id,player_id,occurred_at,season_number,rating_before,rating_after,delta,k_factor,margin_multiplier,opponents,is_historical)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,false)`, [event.id,event.clubId,event.gameId,event.playerId,event.occurredAt,event.seasonNumber,event.ratingBefore,event.ratingAfter,event.delta,event.kFactor,event.marginMultiplier,JSON.stringify(event.opponents)])
}

export async function mutateSupabaseGames(input: { callerUid: string; clubId: string; action: 'create' | 'update' | 'delete' | 'import' | 'rebuild'; gameId?: string; game?: GameInput; games?: GameInput[] }) {
  const clubId = input.clubId.trim().toUpperCase()
  return withTransaction(async (client) => {
    await client.query('select pg_advisory_xact_lock(hashtext($1))', [clubId])
    await requireAccess(client, clubId, input.callerUid, input.action !== 'create')
    let gameId = input.gameId
    const previous = input.action === 'update' || input.action === 'delete' ? await readGame(client, clubId, gameId) : null
    if ((input.action === 'update' || input.action === 'delete') && !previous) throw new Error('Game not found.')
    if (input.action === 'create') gameId = await insertGame(client, clubId, input.game!, input.callerUid)
    else if (input.action === 'delete') {
      await client.query('delete from games where id=$1 and club_id=$2', [gameId, clubId])
      if (previous!.isHistorical) await adjustHistoricalBaseline(client, clubId, previous!, -1)
    } else if (input.action === 'update') {
      const entries = input.game!.entries.map((entry) => ({ playerId: entry.playerId, score: Number(entry.score) })); validate(entries)
      const nextDate = dateOf(input.game!.datetime), nextSeason = Math.max(1, Math.floor(input.game!.seasonNumber ?? 1))
      const { winType, winnerPlayerId } = resultType(entries, input.game!.winType)
      if (winType === 'discard' && !input.game!.loserPlayerId) throw new Error('Discard wins require a loser.')
      await client.query('update games set played_at=$1,season_number=$2,notes=$3,win_type=$4,winner_player_id=$5,loser_player_id=$6,fan=$7 where id=$8 and club_id=$9',
        [nextDate,nextSeason,input.game!.notes?.trim()||null,winType,winnerPlayerId,winType==='discard'?input.game!.loserPlayerId??null:null,input.game!.fan??null,gameId,clubId])
      await client.query('delete from game_entries where game_id=$1', [gameId]); for (const entry of entries) await client.query('insert into game_entries(game_id,player_id,score) values($1,$2,$3)', [gameId,entry.playerId,entry.score])
      if (previous!.isHistorical) {
        await adjustHistoricalBaseline(client, clubId, previous!, -1)
        await adjustHistoricalBaseline(client, clubId, { ...previous!, datetime: nextDate, seasonNumber: nextSeason, entries, winType, winnerPlayerId, loserPlayerId: input.game!.loserPlayerId ?? null }, 1)
      }
    } else if (input.action === 'import') for (const game of input.games ?? []) await insertGame(client, clubId, game, input.callerUid)
    await rebuild(client, clubId)
    return { gameId }
  })
}
