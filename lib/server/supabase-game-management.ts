import 'server-only'
import { randomBytes } from 'node:crypto'
import type { PoolClient } from 'pg'
import { toDateOnly } from '@/lib/date-only'
import {
  calculateRoundEloDeltas,
  computeGlobalRanks,
  type AppConfigLike,
} from '@/lib/stats-engine'
import { calculateSkillRound, initialSkillState } from '@/lib/skill-rating'
import { withTransaction } from '@/lib/postgres-admin'

type Entry = { playerId: string; score: number }
type QueryClient = Pick<PoolClient, 'query'>
type GameInput = {
  datetime?: unknown
  seasonNumber?: number
  entries: Entry[]
  createdBy?: string
  tableId?: string | null
  notes?: string | null
  winType?: 'self_draw' | 'discard' | 'draw'
  loserPlayerId?: string | null
  fan?: number | null
  idempotencyKey?: string
}
type Game = GameInput & {
  id: string
  datetime: Date
  createdBy: string
  seasonNumber: number
  entries: Entry[]
  winnerPlayerId: string | null
  isHistorical: boolean
}
type InsertGameResult =
  | { gameId: string; created: false }
  | { gameId: string; created: true; game: Game }
type Stats = {
  playerId: string
  seasonNumber?: number
  totalPoints: number
  gamesPlayed: number
  gamesWon: number
  gamesLost: number
  winLossRatio: number
  bestSingleGame: number
  worstSingleGame: number
  eloRating: number
  eloPeak: number
  eloGamesPlayed: number
  eloRank: number
  pointsRank: number
  last5EloDelta: number
  playoffSeedScore: number | null
  recentEloDeltas: number[]
  skillMu: number
  skillSigma: number
  skillRating: number
  skillPeak: number
  skillGamesPlayed: number
  skillRank: number
  last5SkillDelta: number
  recentSkillDeltas: number[]
  daysAttended: number
  lastPlayedAt: string | null
}

const KEN_STATS_CUTOFF = Date.parse('2026-04-25T04:00:00.000Z')
const id = () => randomBytes(10).toString('hex')

function dateOf(value: unknown) {
  if (value && typeof value === 'object' && 'seconds' in value)
    return new Date(Number((value as { seconds: number }).seconds) * 1000)
  const date = value ? new Date(value as string | number) : new Date()
  if (!Number.isFinite(date.getTime()))
    throw new Error('Enter a valid game date and time.')
  return date
}

function normalizedEntries(value: unknown): Entry[] {
  if (!Array.isArray(value)) throw new Error('Game entries are required.')
  const entries = value.map((entry) => {
    if (!entry || typeof entry !== 'object')
      throw new Error('Every game entry must identify a player and score.')
    const row = entry as Record<string, unknown>
    return { playerId: String(row.playerId ?? ''), score: Number(row.score) }
  })
  if (
    entries.length < 2 ||
    entries.length > 4 ||
    new Set(entries.map((entry) => entry.playerId)).size !== entries.length
  )
    throw new Error('A game must contain two to four different players.')
  if (
    entries.some(
      (entry) =>
        !entry.playerId ||
        !Number.isSafeInteger(entry.score) ||
        Math.abs(entry.score) > 1_000_000,
    )
  )
    throw new Error(
      'Every score must be a whole number between -1,000,000 and 1,000,000.',
    )
  if (entries.reduce((sum, entry) => sum + Number(entry.score), 0) !== 0)
    throw new Error('Game scores must add up to zero.')
  return entries
}

async function requireAccess(
  client: QueryClient,
  clubId: string,
  uid: string,
  managerOnly: boolean,
) {
  const result = await client.query(
    'select role from club_members where club_id=$1 and firebase_uid=$2 and active=true',
    [clubId, uid],
  )
  if (!result.rowCount || (managerOnly && result.rows[0].role !== 'manager'))
    throw new Error(
      managerOnly
        ? 'Only an active club manager can modify game records.'
        : 'Only an active club member can record games.',
    )
}

function resultType(
  entries: Entry[],
  requested?: GameInput['winType'],
): {
  winType: NonNullable<GameInput['winType']>
  winnerPlayerId: string | null
} {
  const draw = entries.every((entry) => Number(entry.score) === 0)
  const winType = draw
    ? 'draw'
    : requested === 'discard'
      ? 'discard'
      : 'self_draw'
  const winnerPlayerId = draw
    ? null
    : entries.reduce((best, entry) =>
        Number(entry.score) > Number(best.score) ? entry : best,
      ).playerId
  return { winType, winnerPlayerId }
}

export async function insertGame(
  client: QueryClient,
  clubId: string,
  input: GameInput,
  callerUid: string,
): Promise<InsertGameResult> {
  const entries = normalizedEntries(input.entries)
  const idempotencyKey = input.idempotencyKey?.trim().slice(0, 100) || null
  const datetime = dateOf(input.datetime)
  const seasonNumber = Math.max(1, Math.floor(input.seasonNumber ?? 1))
  const preflight = (
    await client.query(
      `select
        (select id from games where club_id=$1 and idempotency_key=$2) existing_game_id,
        (select count(*)::int from players where club_id=$1 and active and id=any($3::text[])) player_count,
        exists(select 1 from seasons where club_id=$1 and season_number=$4) season_exists`,
      [
        clubId,
        idempotencyKey,
        entries.map((entry) => entry.playerId),
        seasonNumber,
      ],
    )
  ).rows[0]
  if (preflight.existing_game_id)
    return { gameId: String(preflight.existing_game_id), created: false }
  if (Number(preflight.player_count) !== entries.length)
    throw new Error('Every game player must be active in this club.')
  if (!preflight.season_exists) throw new Error('That season no longer exists.')

  const gameId = id()
  const { winType, winnerPlayerId } = resultType(entries, input.winType)
  if (
    winType === 'discard' &&
    (!input.loserPlayerId ||
      !entries.some((entry) => entry.playerId === input.loserPlayerId) ||
      input.loserPlayerId === winnerPlayerId)
  )
    throw new Error(
      'Discard wins require a different losing player from this game.',
    )
  const fan = winType === 'draw' || input.fan == null ? null : Number(input.fan)
  if (fan !== null && (!Number.isInteger(fan) || fan < 3 || fan > 13))
    throw new Error('Winning games require a fan value from 3 to 13.')
  const createdBy = input.createdBy ?? callerUid
  await client.query(
    `insert into games(id,club_id,played_at,created_by,season_number,table_id,win_type,winner_player_id,loser_player_id,fan,notes,is_historical,idempotency_key)
    values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,false,$12)`,
    [
      gameId,
      clubId,
      datetime,
      createdBy,
      seasonNumber,
      input.tableId?.trim().slice(0, 20) || null,
      winType,
      winnerPlayerId,
      winType === 'discard' ? (input.loserPlayerId ?? null) : null,
      fan,
      input.notes?.trim().slice(0, 2000) || null,
      idempotencyKey,
    ],
  )
  const parameters = entries.flatMap((entry) => [
    gameId,
    entry.playerId,
    entry.score,
  ])
  const values = entries
    .map(
      (_, index) => `($${index * 3 + 1},$${index * 3 + 2},$${index * 3 + 3})`,
    )
    .join(',')
  await client.query(
    `insert into game_entries(game_id,player_id,score) values ${values}`,
    parameters,
  )
  const game: Game = {
    ...input,
    id: gameId,
    datetime,
    createdBy,
    seasonNumber,
    entries,
    winType,
    winnerPlayerId,
    loserPlayerId: winType === 'discard' ? (input.loserPlayerId ?? null) : null,
    isHistorical: false,
  }
  return { gameId, created: true, game }
}

async function readGame(
  client: QueryClient,
  clubId: string,
  gameId?: string,
): Promise<Game | null> {
  if (!gameId) return null
  const result = await client.query(
    `select g.*, coalesce(json_agg(json_build_object('playerId',e.player_id,'score',e.score)) filter(where e.player_id is not null),'[]') entries
    from games g left join game_entries e on e.game_id=g.id where g.club_id=$1 and g.id=$2 group by g.id`,
    [clubId, gameId],
  )
  const row = result.rows[0]
  return row
    ? {
        id: row.id,
        datetime: new Date(row.played_at),
        createdBy: row.created_by,
        seasonNumber: row.season_number,
        entries: row.entries,
        tableId: row.table_id,
        notes: row.notes,
        winType: row.win_type,
        loserPlayerId: row.loser_player_id,
        fan: row.fan,
        winnerPlayerId: row.winner_player_id,
        isHistorical: row.is_historical,
      }
    : null
}

function countsTowardMetrics(
  clubId: string,
  game: Pick<Game, 'seasonNumber' | 'datetime'>,
) {
  return (
    clubId !== 'KEN' ||
    game.seasonNumber !== 2 ||
    game.datetime.getTime() >= KEN_STATS_CUTOFF
  )
}

async function adjustHistoricalBaseline(
  client: QueryClient,
  clubId: string,
  game: Game,
  direction: 1 | -1,
) {
  const counted = countsTowardMetrics(clubId, game)
  for (const entry of game.entries) {
    for (const seasonNumber of [0, game.seasonNumber]) {
      await client.query(
        `insert into stat_baselines(club_id,season_number,player_id) values($1,$2,$3)
        on conflict(club_id,season_number,player_id) do nothing`,
        [clubId, seasonNumber, entry.playerId],
      )
      const points = direction * Number(entry.score)
      const games = counted ? direction : 0
      const wins = counted && entry.score > 0 ? direction : 0
      const losses = counted && entry.score < 0 ? direction : 0
      await client.query(
        `update stat_baselines set total_points=total_points+$1, games_played=greatest(0,games_played+$2), games_won=greatest(0,games_won+$3), games_lost=greatest(0,games_lost+$4),
        win_loss_ratio=(greatest(0,games_won+$3)::double precision / greatest(1,games_lost+$4)), updated_at=now()
        where club_id=$5 and season_number=$6 and player_id=$7`,
        [points, games, wins, losses, clubId, seasonNumber, entry.playerId],
      )
    }
  }
  if (!counted) return
  for (const playerId of new Set(game.entries.map((entry) => entry.playerId))) {
    const extrema = await client.query(
      `select max(e.score) best, min(e.score) worst, count(distinct g.played_at::date)::int days, max(g.played_at)::date last_played
      from games g join game_entries e on e.game_id=g.id where g.club_id=$1 and g.is_historical=true and e.player_id=$2
      and ($1 <> 'KEN' or g.season_number <> 2 or g.played_at >= to_timestamp($3 / 1000.0))`,
      [clubId, playerId, KEN_STATS_CUTOFF],
    )
    for (const seasonNumber of [0, game.seasonNumber])
      await client.query(
        `update stat_baselines set best_single_game=$1,worst_single_game=$2,days_attended=$3,last_played_at=$4,updated_at=now()
      where club_id=$5 and season_number=$6 and player_id=$7`,
        [
          extrema.rows[0].best,
          extrema.rows[0].worst,
          extrema.rows[0].days,
          extrema.rows[0].last_played,
          clubId,
          seasonNumber,
          playerId,
        ],
      )
  }
}

function baselineStats(row: Record<string, unknown>): Stats {
  return {
    playerId: String(row.player_id),
    ...(Number(row.season_number)
      ? { seasonNumber: Number(row.season_number) }
      : {}),
    totalPoints: Number(row.total_points),
    gamesPlayed: Number(row.games_played),
    gamesWon: Number(row.games_won),
    gamesLost: Number(row.games_lost),
    winLossRatio: Number(row.win_loss_ratio),
    bestSingleGame:
      row.best_single_game == null
        ? Number.NEGATIVE_INFINITY
        : Number(row.best_single_game),
    worstSingleGame:
      row.worst_single_game == null
        ? Number.POSITIVE_INFINITY
        : Number(row.worst_single_game),
    eloRating: Number(row.elo_rating),
    eloPeak: Number(row.elo_peak),
    eloGamesPlayed: Number(row.elo_games_played),
    eloRank: 0,
    pointsRank: 0,
    last5EloDelta: Number(row.last5_elo_delta),
    playoffSeedScore:
      row.playoff_seed_score == null ? null : Number(row.playoff_seed_score),
    recentEloDeltas: (row.recent_elo_deltas as number[]) ?? [],
    skillMu: 25,
    skillSigma: 25 / 3,
    skillRating: 1500,
    skillPeak: 1500,
    skillGamesPlayed: 0,
    skillRank: 0,
    last5SkillDelta: 0,
    recentSkillDeltas: [],
    daysAttended: Number(row.days_attended),
    lastPlayedAt: toDateOnly(row.last_played_at),
  }
}

const statsColumns = [
  'club_id',
  'player_id',
  'total_points',
  'games_played',
  'games_won',
  'games_lost',
  'win_loss_ratio',
  'best_single_game',
  'worst_single_game',
  'elo_rating',
  'elo_peak',
  'elo_games_played',
  'elo_rank',
  'points_rank',
  'last5_elo_delta',
  'playoff_seed_score',
  'recent_elo_deltas',
  'skill_mu',
  'skill_sigma',
  'skill_rating',
  'skill_peak',
  'skill_games_played',
  'skill_rank',
  'last5_skill_delta',
  'recent_skill_deltas',
  'days_attended',
  'last_played_at',
]

function statsRow(clubId: string, value: Stats) {
  return [
    clubId,
    value.playerId,
    value.totalPoints,
    value.gamesPlayed,
    value.gamesWon,
    value.gamesLost,
    value.winLossRatio,
    Number.isFinite(value.bestSingleGame) ? value.bestSingleGame : null,
    Number.isFinite(value.worstSingleGame) ? value.worstSingleGame : null,
    value.eloRating,
    value.eloPeak,
    value.eloGamesPlayed,
    value.eloRank,
    value.pointsRank,
    value.last5EloDelta,
    value.playoffSeedScore,
    value.recentEloDeltas,
    value.skillMu,
    value.skillSigma,
    value.skillRating,
    value.skillPeak,
    value.skillGamesPlayed,
    value.skillRank,
    value.last5SkillDelta,
    value.recentSkillDeltas,
    value.daysAttended,
    value.lastPlayedAt,
  ]
}

async function insertRows(
  client: QueryClient,
  table: string,
  columns: string[],
  rows: unknown[][],
  suffix = '',
) {
  const batchSize = Math.max(1, Math.floor(30_000 / columns.length))
  for (let offset = 0; offset < rows.length; offset += batchSize) {
    const batch = rows.slice(offset, offset + batchSize),
      parameters: unknown[] = []
    const placeholders = batch.map((row) => {
      const start = parameters.length
      parameters.push(...row)
      return `(${row.map((_, index) => `$${start + index + 1}`).join(',')})`
    })
    await client.query(
      `insert into ${table}(${columns.join(',')}) values ${placeholders.join(',')} ${suffix}`,
      parameters,
    )
  }
}

export function storedStats(
  row: Record<string, unknown>,
  startingElo: number,
  seasonNumber?: number,
): Stats {
  const initial = initialSkillState()
  return {
    playerId: String(row.player_id),
    ...(seasonNumber == null ? {} : { seasonNumber }),
    totalPoints: Number(row.total_points ?? 0),
    gamesPlayed: Number(row.games_played ?? 0),
    gamesWon: Number(row.games_won ?? 0),
    gamesLost: Number(row.games_lost ?? 0),
    winLossRatio: Number(row.win_loss_ratio ?? 0),
    bestSingleGame:
      row.best_single_game == null
        ? Number.NEGATIVE_INFINITY
        : Number(row.best_single_game),
    worstSingleGame:
      row.worst_single_game == null
        ? Number.POSITIVE_INFINITY
        : Number(row.worst_single_game),
    eloRating: Number(row.elo_rating ?? startingElo),
    eloPeak: Number(row.elo_peak ?? startingElo),
    eloGamesPlayed: Number(row.elo_games_played ?? 0),
    eloRank: Number(row.elo_rank ?? 0),
    pointsRank: Number(row.points_rank ?? 0),
    last5EloDelta: Number(row.last5_elo_delta ?? 0),
    playoffSeedScore:
      row.playoff_seed_score == null ? null : Number(row.playoff_seed_score),
    recentEloDeltas: (row.recent_elo_deltas as number[] | null) ?? [],
    skillMu: Number(row.skill_mu ?? initial.mu),
    skillSigma: Number(row.skill_sigma ?? initial.sigma),
    skillRating: Number(row.skill_rating ?? 1500),
    skillPeak: Number(row.skill_peak ?? 1500),
    skillGamesPlayed: Number(row.skill_games_played ?? 0),
    skillRank: Number(row.skill_rank ?? 0),
    last5SkillDelta: Number(row.last5_skill_delta ?? 0),
    recentSkillDeltas: (row.recent_skill_deltas as number[] | null) ?? [],
    daysAttended: Number(row.days_attended ?? 0),
    lastPlayedAt: toDateOnly(row.last_played_at),
  }
}

export function applyNewGame(
  currentByPlayer: Map<string, Stats>,
  game: Game,
  config: AppConfigLike,
) {
  const startingElo = config.eloStartingRating ?? 1500
  const initial = initialSkillState()
  const current = (playerId: string) =>
    currentByPlayer.get(playerId) ??
    storedStats(
      {
        player_id: playerId,
        elo_rating: startingElo,
        elo_peak: startingElo,
        skill_mu: initial.mu,
        skill_sigma: initial.sigma,
      },
      startingElo,
      currentByPlayer.values().next().value?.seasonNumber,
    )
  const eloResults = calculateRoundEloDeltas(
    game.entries.map((entry) => ({
      ...entry,
      ratingBefore: current(entry.playerId).eloRating,
      gamesPlayed: current(entry.playerId).eloGamesPlayed,
    })),
    config,
  )
  const skillResults = calculateSkillRound(
    game.entries.map((entry) => ({
      ...entry,
      mu: current(entry.playerId).skillMu,
      sigma: current(entry.playerId).skillSigma,
      gamesPlayed: current(entry.playerId).skillGamesPlayed,
    })),
  )
  const day = game.datetime.toISOString().slice(0, 10)
  for (const entry of game.entries) {
    const previous = current(entry.playerId)
    const elo = eloResults.find((result) => result.playerId === entry.playerId)!
    const skill = skillResults.find(
      (result) => result.playerId === entry.playerId,
    )!
    const recentEloDeltas = [...previous.recentEloDeltas, elo.delta].slice(-5)
    const recentSkillDeltas = [
      ...previous.recentSkillDeltas,
      skill.delta,
    ].slice(-5)
    const gamesWon = previous.gamesWon + (entry.score > 0 ? 1 : 0)
    const gamesLost = previous.gamesLost + (entry.score < 0 ? 1 : 0)
    currentByPlayer.set(entry.playerId, {
      ...previous,
      totalPoints: previous.totalPoints + entry.score,
      gamesPlayed: previous.gamesPlayed + 1,
      gamesWon,
      gamesLost,
      winLossRatio: gamesWon / Math.max(1, gamesLost),
      bestSingleGame: Math.max(previous.bestSingleGame, entry.score),
      worstSingleGame: Math.min(previous.worstSingleGame, entry.score),
      eloRating: elo.ratingAfter,
      eloPeak: Math.max(previous.eloPeak, elo.ratingAfter),
      eloGamesPlayed: previous.eloGamesPlayed + 1,
      last5EloDelta: recentEloDeltas.reduce((sum, value) => sum + value, 0),
      recentEloDeltas,
      skillMu: skill.mu,
      skillSigma: skill.sigma,
      skillRating: skill.ratingAfter,
      skillPeak: Math.max(previous.skillPeak, skill.ratingAfter),
      skillGamesPlayed: skill.gamesPlayed,
      last5SkillDelta: recentSkillDeltas.reduce((sum, value) => sum + value, 0),
      recentSkillDeltas,
      daysAttended:
        previous.daysAttended + (previous.lastPlayedAt === day ? 0 : 1),
      lastPlayedAt: day,
    })
  }
  return { eloResults, skillResults }
}

async function writeStats(
  client: QueryClient,
  clubId: string,
  values: Stats[],
  seasonNumber?: number,
) {
  const columns =
    seasonNumber == null
      ? statsColumns
      : [statsColumns[0], 'season_number', ...statsColumns.slice(1)]
  const rows = values.map((value) =>
    seasonNumber == null
      ? statsRow(clubId, value)
      : [clubId, seasonNumber, ...statsRow(clubId, value).slice(1)],
  )
  const conflict =
    seasonNumber == null
      ? '(club_id,player_id)'
      : '(club_id,season_number,player_id)'
  const updates = columns
    .filter(
      (column) => !['club_id', 'season_number', 'player_id'].includes(column),
    )
    .map((column) => `${column}=excluded.${column}`)
    .join(',')
  await insertRows(
    client,
    seasonNumber == null ? 'player_stats' : 'season_player_stats',
    columns,
    rows,
    `on conflict ${conflict} do update set ${updates},updated_at=now()`,
  )
}

export async function appendNewGame(
  client: QueryClient,
  clubId: string,
  game: Game,
) {
  const playerIds = game.entries.map((entry) => entry.playerId)
  const state = (
    await client.query(
      `with all_stats as (
         select * from player_stats where club_id=$1 and player_id=any($2::text[]) order by player_id for update
       ), season_stats as (
         select * from season_player_stats where club_id=$1 and season_number=$3 and player_id=any($2::text[]) order by player_id for update
       )
       select coalesce((select to_jsonb(c) from app_configs c where c.club_id=$1),'{}'::jsonb) config,
         coalesce((select jsonb_agg(to_jsonb(a)) from all_stats a),'[]'::jsonb) all_stats,
         coalesce((select jsonb_agg(to_jsonb(s)) from season_stats s),'[]'::jsonb) season_stats`,
      [clubId, playerIds, game.seasonNumber],
    )
  ).rows[0]
  const raw = state.config ?? {}
  const config: AppConfigLike = {
    eloBaseK: raw.elo_base_k,
    eloVeteranGamesThreshold: raw.elo_veteran_games_threshold,
    eloStartingRating: raw.elo_starting_rating,
    eloNewPlayerK: raw.elo_new_player_k,
    eloIntermediateK: raw.elo_intermediate_k,
    eloNewPlayerGamesThreshold: raw.elo_new_player_games_threshold,
  }
  const startingElo = config.eloStartingRating ?? 1500
  const all = new Map(
    (state.all_stats as Record<string, unknown>[]).map((row) => [
      String(row.player_id),
      storedStats(row, startingElo),
    ]),
  )
  const seasonal = new Map(
    (state.season_stats as Record<string, unknown>[]).map((row) => [
      String(row.player_id),
      storedStats(row, startingElo, game.seasonNumber),
    ]),
  )
  const allResults = applyNewGame(all, game, config)
  const seasonResults = applyNewGame(seasonal, game, config)
  await writeStats(
    client,
    clubId,
    game.entries.map((entry) => all.get(entry.playerId)!),
    undefined,
  )
  await writeStats(
    client,
    clubId,
    game.entries.map((entry) => seasonal.get(entry.playerId)!),
    game.seasonNumber,
  )
  await insertRows(
    client,
    'elo_events',
    [
      'id',
      'club_id',
      'game_id',
      'player_id',
      'occurred_at',
      'season_number',
      'rating_before',
      'rating_after',
      'delta',
      'k_factor',
      'margin_multiplier',
      'opponents',
      'is_historical',
    ],
    seasonResults.eloResults.map((event) => [
      `${game.id}_${event.playerId}`,
      clubId,
      game.id,
      event.playerId,
      game.datetime,
      game.seasonNumber,
      event.ratingBefore,
      event.ratingAfter,
      event.delta,
      event.kFactor,
      event.marginMultiplier,
      JSON.stringify(event.opponents),
      false,
    ]),
  )
  await insertRows(
    client,
    'skill_events',
    [
      'id',
      'club_id',
      'game_id',
      'player_id',
      'occurred_at',
      'season_number',
      'rating_before',
      'rating_after',
      'delta',
      'mu',
      'sigma',
    ],
    seasonResults.skillResults.map((event) => [
      `${game.id}_${event.playerId}`,
      clubId,
      game.id,
      event.playerId,
      game.datetime,
      game.seasonNumber,
      event.ratingBefore,
      event.ratingAfter,
      event.delta,
      event.mu,
      event.sigma,
    ]),
  )
  return allResults
}

export async function rebuild(client: QueryClient, clubId: string) {
  const gameRows = await client.query(
    `select g.*, coalesce(json_agg(json_build_object('playerId',e.player_id,'score',e.score)) filter(where e.player_id is not null),'[]') entries
    from games g left join game_entries e on e.game_id=g.id where g.club_id=$1 and g.is_historical=false group by g.id order by g.played_at,g.id`,
    [clubId],
  )
  const skillGameRows = await client.query(
    `select g.*, coalesce(json_agg(json_build_object('playerId',e.player_id,'score',e.score)) filter(where e.player_id is not null),'[]') entries
    from games g left join game_entries e on e.game_id=g.id where g.club_id=$1 group by g.id order by g.played_at,g.id`,
    [clubId],
  )
  const configRows = await client.query(
    'select * from app_configs where club_id=$1',
    [clubId],
  )
  const baselineRows = await client.query(
    'select * from stat_baselines where club_id=$1',
    [clubId],
  )
  const games: Game[] = gameRows.rows.map((row) => ({
    id: row.id,
    datetime: new Date(row.played_at),
    createdBy: row.created_by,
    seasonNumber: row.season_number,
    entries: row.entries,
    tableId: row.table_id,
    notes: row.notes,
    winType: row.win_type,
    loserPlayerId: row.loser_player_id,
    fan: row.fan,
    winnerPlayerId: row.winner_player_id,
    isHistorical: false,
  }))
  const skillGames: Game[] = skillGameRows.rows.map((row) => ({
    id: row.id,
    datetime: new Date(row.played_at),
    createdBy: row.created_by,
    seasonNumber: row.season_number,
    entries: row.entries,
    tableId: row.table_id,
    notes: row.notes,
    winType: row.win_type,
    loserPlayerId: row.loser_player_id,
    fan: row.fan,
    winnerPlayerId: row.winner_player_id,
    isHistorical: Boolean(row.is_historical),
  }))
  const raw = configRows.rows[0] ?? {}
  const config: AppConfigLike = {
    eloBaseK: raw.elo_base_k,
    eloVeteranGamesThreshold: raw.elo_veteran_games_threshold,
    eloStartingRating: raw.elo_starting_rating,
    eloNewPlayerK: raw.elo_new_player_k,
    eloIntermediateK: raw.elo_intermediate_k,
    eloNewPlayerGamesThreshold: raw.elo_new_player_games_threshold,
  }
  const start = config.eloStartingRating ?? 1500
  const initialSkill = initialSkillState()
  const make = (playerId: string, seasonNumber?: number): Stats => ({
    playerId,
    ...(seasonNumber == null ? {} : { seasonNumber }),
    totalPoints: 0,
    gamesPlayed: 0,
    gamesWon: 0,
    gamesLost: 0,
    winLossRatio: 0,
    bestSingleGame: Number.NEGATIVE_INFINITY,
    worstSingleGame: Number.POSITIVE_INFINITY,
    eloRating: start,
    eloPeak: start,
    eloGamesPlayed: 0,
    eloRank: 0,
    pointsRank: 0,
    last5EloDelta: 0,
    playoffSeedScore: null,
    recentEloDeltas: [],
    skillMu: initialSkill.mu,
    skillSigma: initialSkill.sigma,
    skillRating: 1500,
    skillPeak: 1500,
    skillGamesPlayed: 0,
    skillRank: 0,
    last5SkillDelta: 0,
    recentSkillDeltas: [],
    daysAttended: 0,
    lastPlayedAt: null,
  })
  const all = new Map<string, Stats>(),
    seasonal = new Map<string, Stats>(),
    events: Array<Record<string, unknown>> = []
  for (const row of baselineRows.rows) {
    const value = baselineStats(row)
    if (Number(row.season_number) === 0) all.set(value.playerId, value)
    else seasonal.set(`${row.season_number}_${value.playerId}`, value)
  }
  const apply = (
    map: Map<string, Stats>,
    keyFor: (playerId: string) => string,
    game: Game,
    seasonNumber?: number,
  ) => {
    const round = game.entries.map((entry) => {
      const current =
        map.get(keyFor(entry.playerId)) ?? make(entry.playerId, seasonNumber)
      return {
        ...entry,
        ratingBefore: current.eloRating,
        gamesPlayed: current.eloGamesPlayed,
      }
    })
    const results = calculateRoundEloDeltas(round, config)
    for (const entry of game.entries) {
      const key = keyFor(entry.playerId),
        current = map.get(key) ?? make(entry.playerId, seasonNumber),
        result = results.find((item) => item.playerId === entry.playerId)!
      const day = game.datetime.toISOString().slice(0, 10),
        recent = [...current.recentEloDeltas, result.delta].slice(-5)
      const wins = current.gamesWon + (entry.score > 0 ? 1 : 0),
        losses = current.gamesLost + (entry.score < 0 ? 1 : 0)
      map.set(key, {
        ...current,
        totalPoints: current.totalPoints + entry.score,
        gamesPlayed: current.gamesPlayed + 1,
        gamesWon: wins,
        gamesLost: losses,
        winLossRatio: wins / Math.max(1, losses),
        bestSingleGame: Math.max(current.bestSingleGame, entry.score),
        worstSingleGame: Math.min(current.worstSingleGame, entry.score),
        eloRating: result.ratingAfter,
        eloPeak: Math.max(current.eloPeak, result.ratingAfter),
        eloGamesPlayed: current.eloGamesPlayed + 1,
        last5EloDelta: recent.reduce((sum, value) => sum + value, 0),
        recentEloDeltas: recent,
        daysAttended:
          current.daysAttended + (current.lastPlayedAt === day ? 0 : 1),
        lastPlayedAt: day,
      })
    }
    return results
  }
  for (const game of games) {
    apply(all, (playerId) => playerId, game)
    const results = apply(
      seasonal,
      (playerId) => `${game.seasonNumber}_${playerId}`,
      game,
      game.seasonNumber,
    )
    for (const result of results)
      events.push({
        id: `${game.id}_${result.playerId}`,
        clubId,
        gameId: game.id,
        playerId: result.playerId,
        occurredAt: game.datetime,
        seasonNumber: game.seasonNumber,
        ratingBefore: result.ratingBefore,
        ratingAfter: result.ratingAfter,
        delta: result.delta,
        kFactor: result.kFactor,
        marginMultiplier: result.marginMultiplier,
        opponents: result.opponents,
      })
  }
  const skillAll = new Map<string, Stats>(),
    skillSeasonal = new Map<string, Stats>(),
    skillEvents: Array<Record<string, unknown>> = []
  const applySkill = (
    map: Map<string, Stats>,
    keyFor: (playerId: string) => string,
    game: Game,
    seasonNumber?: number,
  ) => {
    const round = game.entries.map((entry) => {
      const current =
        map.get(keyFor(entry.playerId)) ?? make(entry.playerId, seasonNumber)
      return {
        ...entry,
        mu: current.skillMu,
        sigma: current.skillSigma,
        gamesPlayed: current.skillGamesPlayed,
      }
    })
    const results = calculateSkillRound(round)
    for (const result of results) {
      const key = keyFor(result.playerId),
        current = map.get(key) ?? make(result.playerId, seasonNumber),
        recent = [...current.recentSkillDeltas, result.delta].slice(-5)
      map.set(key, {
        ...current,
        skillMu: result.mu,
        skillSigma: result.sigma,
        skillRating: result.ratingAfter,
        skillPeak: Math.max(current.skillPeak, result.ratingAfter),
        skillGamesPlayed: result.gamesPlayed,
        last5SkillDelta: recent.reduce((sum, value) => sum + value, 0),
        recentSkillDeltas: recent,
      })
    }
    return results
  }
  for (const game of skillGames) {
    applySkill(skillAll, (playerId) => playerId, game)
    const results = applySkill(
      skillSeasonal,
      (playerId) => `${game.seasonNumber}_${playerId}`,
      game,
      game.seasonNumber,
    )
    for (const result of results)
      skillEvents.push({
        ...result,
        id: `${game.id}_${result.playerId}`,
        clubId,
        gameId: game.id,
        occurredAt: game.datetime,
        seasonNumber: game.seasonNumber,
      })
  }
  const mergeSkill = (target: Stats, source?: Stats): Stats =>
    source
      ? {
          ...target,
          skillMu: source.skillMu,
          skillSigma: source.skillSigma,
          skillRating: source.skillRating,
          skillPeak: source.skillPeak,
          skillGamesPlayed: source.skillGamesPlayed,
          skillRank: source.skillRank,
          last5SkillDelta: source.last5SkillDelta,
          recentSkillDeltas: source.recentSkillDeltas,
        }
      : target
  for (const [key, value] of all)
    all.set(key, mergeSkill(value, skillAll.get(key)))
  for (const [key, value] of seasonal)
    seasonal.set(key, mergeSkill(value, skillSeasonal.get(key)))
  for (const [key, value] of skillAll)
    if (!all.has(key)) all.set(key, mergeSkill(make(value.playerId), value))
  for (const [key, value] of skillSeasonal)
    if (!seasonal.has(key))
      seasonal.set(
        key,
        mergeSkill(make(value.playerId, value.seasonNumber), value),
      )
  const rank = (values: Stats[]) => {
    const ranks = computeGlobalRanks(values)
    const skillOrder = [...values].sort((a, b) => b.skillRating - a.skillRating)
    for (const value of values) {
      value.eloRank = ranks.eloRanks[value.playerId] ?? 0
      value.pointsRank = ranks.pointsRanks[value.playerId] ?? 0
      value.skillRank =
        skillOrder.findIndex((item) => item.playerId === value.playerId) + 1
    }
  }
  rank([...all.values()])
  for (const season of new Set(
    [...seasonal.values()].map((value) => value.seasonNumber!),
  ))
    rank(
      [...seasonal.values()].filter((value) => value.seasonNumber === season),
    )
  await client.query(
    'delete from elo_events where club_id=$1 and is_historical=false',
    [clubId],
  )
  await client.query('delete from skill_events where club_id=$1', [clubId])
  await client.query('delete from season_player_stats where club_id=$1', [
    clubId,
  ])
  await client.query('delete from player_stats where club_id=$1', [clubId])
  await insertRows(
    client,
    'player_stats',
    statsColumns,
    [...all.values()].map((value) => statsRow(clubId, value)),
  )
  await insertRows(
    client,
    'season_player_stats',
    [statsColumns[0], 'season_number', ...statsColumns.slice(1)],
    [...seasonal.values()].map((value) => [
      clubId,
      value.seasonNumber,
      ...statsRow(clubId, value).slice(1),
    ]),
  )
  await insertRows(
    client,
    'elo_events',
    [
      'id',
      'club_id',
      'game_id',
      'player_id',
      'occurred_at',
      'season_number',
      'rating_before',
      'rating_after',
      'delta',
      'k_factor',
      'margin_multiplier',
      'opponents',
      'is_historical',
    ],
    events.map((event) => [
      event.id,
      event.clubId,
      event.gameId,
      event.playerId,
      event.occurredAt,
      event.seasonNumber,
      event.ratingBefore,
      event.ratingAfter,
      event.delta,
      event.kFactor,
      event.marginMultiplier,
      JSON.stringify(event.opponents),
      false,
    ]),
  )
  await insertRows(
    client,
    'skill_events',
    [
      'id',
      'club_id',
      'game_id',
      'player_id',
      'occurred_at',
      'season_number',
      'rating_before',
      'rating_after',
      'delta',
      'mu',
      'sigma',
    ],
    skillEvents.map((event) => [
      event.id,
      event.clubId,
      event.gameId,
      event.playerId,
      event.occurredAt,
      event.seasonNumber,
      event.ratingBefore,
      event.ratingAfter,
      event.delta,
      event.mu,
      event.sigma,
    ]),
  )
}

export async function mutateSupabaseGames(input: {
  callerUid: string
  clubId: string
  action: 'create' | 'update' | 'delete' | 'import' | 'rebuild'
  gameId?: string
  game?: GameInput
  games?: GameInput[]
}) {
  const clubId = input.clubId.trim().toUpperCase()
  return withTransaction(async (client) => {
    await client.query("select set_config('app.actor_uid', $1, true)", [
      input.callerUid,
    ])
    await requireAccess(
      client,
      clubId,
      input.callerUid,
      input.action !== 'create',
    )
    const incrementalCreate =
      input.action === 'create' &&
      input.game != null &&
      input.game.datetime == null
    if (incrementalCreate) {
      const entries = normalizedEntries(input.game!.entries)
      await client.query('select pg_advisory_xact_lock_shared(hashtext($1))', [
        `games:${clubId}`,
      ])
      if (input.game!.idempotencyKey)
        await client.query('select pg_advisory_xact_lock(hashtext($1))', [
          `game-request:${clubId}:${input.game!.idempotencyKey}`,
        ])
      const playerLocks = [
        ...new Set(
          entries.map((entry) => `game-player:${clubId}:${entry.playerId}`),
        ),
      ].sort()
      await client.query(
        'select pg_advisory_xact_lock(hashtext(lock_key)) from unnest($1::text[]) lock_key order by lock_key',
        [playerLocks],
      )
      const inserted = await insertGame(
        client,
        clubId,
        { ...input.game!, createdBy: input.callerUid },
        input.callerUid,
      )
      if (inserted.created) {
        await appendNewGame(client, clubId, inserted.game)
        const tableNumber = Number(inserted.game.tableId)
        if (Number.isInteger(tableNumber) && tableNumber > 0) {
          await client.query(
            `insert into session_table_activity(session_id,table_number,occupied_since,last_game_at,last_roster_change_at,cleared_at)
            select s.id,$2,coalesce(a.occupied_since,now()),now(),now(),null from sessions s
            left join session_table_activity a on a.session_id=s.id and a.table_number=$2
            where s.club_id=$1 and s.is_active
            on conflict(session_id,table_number) do update set last_game_at=now(),last_roster_change_at=now(),cleared_at=null`,
            [clubId, tableNumber],
          )
        }
      }
      return { gameId: inserted.gameId }
    }

    await client.query('select pg_advisory_xact_lock(hashtext($1))', [
      `games:${clubId}`,
    ])
    let gameId = input.gameId
    const previous =
      input.action === 'update' || input.action === 'delete'
        ? await readGame(client, clubId, gameId)
        : null
    if ((input.action === 'update' || input.action === 'delete') && !previous)
      throw new Error('Game not found.')
    if (input.action === 'create')
      gameId = (
        await insertGame(
          client,
          clubId,
          { ...input.game!, createdBy: input.callerUid },
          input.callerUid,
        )
      ).gameId
    else if (input.action === 'delete') {
      await client.query('delete from games where id=$1 and club_id=$2', [
        gameId,
        clubId,
      ])
      if (previous!.isHistorical)
        await adjustHistoricalBaseline(client, clubId, previous!, -1)
    } else if (input.action === 'update') {
      const entries = normalizedEntries(input.game!.entries)
      const nextDate = dateOf(input.game!.datetime),
        nextSeason = Math.max(1, Math.floor(input.game!.seasonNumber ?? 1))
      const references = (
        await client.query(
          `select
            (select count(*)::int from players where club_id=$1 and active and id=any($2::text[])) player_count,
            exists(select 1 from seasons where club_id=$1 and season_number=$3) season_exists`,
          [clubId, entries.map((entry) => entry.playerId), nextSeason],
        )
      ).rows[0]
      if (Number(references.player_count) !== entries.length)
        throw new Error('Every game player must be active in this club.')
      if (!references.season_exists)
        throw new Error('That season no longer exists.')
      const { winType, winnerPlayerId } = resultType(
        entries,
        input.game!.winType,
      )
      if (
        winType === 'discard' &&
        (!input.game!.loserPlayerId ||
          !entries.some(
            (entry) => entry.playerId === input.game!.loserPlayerId,
          ) ||
          input.game!.loserPlayerId === winnerPlayerId)
      )
        throw new Error(
          'Discard wins require a different losing player from this game.',
        )
      const fan =
        winType === 'draw' || input.game!.fan == null
          ? null
          : Number(input.game!.fan)
      if (fan !== null && (!Number.isInteger(fan) || fan < 3 || fan > 13))
        throw new Error('Winning games require a fan value from 3 to 13.')
      await client.query(
        'update games set played_at=$1,season_number=$2,notes=$3,win_type=$4,winner_player_id=$5,loser_player_id=$6,fan=$7 where id=$8 and club_id=$9',
        [
          nextDate,
          nextSeason,
          input.game!.notes?.trim().slice(0, 2000) || null,
          winType,
          winnerPlayerId,
          winType === 'discard' ? (input.game!.loserPlayerId ?? null) : null,
          fan,
          gameId,
          clubId,
        ],
      )
      await client.query('delete from game_entries where game_id=$1', [gameId])
      await insertRows(
        client,
        'game_entries',
        ['game_id', 'player_id', 'score'],
        entries.map((entry) => [gameId, entry.playerId, entry.score]),
      )
      if (previous!.isHistorical) {
        await adjustHistoricalBaseline(client, clubId, previous!, -1)
        await adjustHistoricalBaseline(
          client,
          clubId,
          {
            ...previous!,
            datetime: nextDate,
            seasonNumber: nextSeason,
            entries,
            winType,
            winnerPlayerId,
            loserPlayerId: input.game!.loserPlayerId ?? null,
          },
          1,
        )
      }
    } else if (input.action === 'import')
      for (const game of input.games ?? [])
        await insertGame(client, clubId, game, input.callerUid)
    await rebuild(client, clubId)
    return { gameId }
  })
}
