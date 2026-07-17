'use client'

import { Timestamp } from '@/lib/timestamp'
import { auth } from '@/lib/firebase'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import { realtimeChannelName } from '@/lib/realtime-channel'
import {
  createInitialSessionLayout,
  normalizeSessionLayout,
} from '@/lib/session-layout'
import { computeGlobalRanks } from '@/lib/stats-engine'
import type {
  AccountDeletionPlan,
  AccountManagerResolution,
  ClubDoc,
  ClubMembershipDoc,
  GameDoc,
  JoinRequestDoc,
  PlayerDoc,
  PlayerStatsDoc,
  SeasonDoc,
  SessionDoc,
  SkillEventDoc,
} from '@/lib/types'

type UserLike = {
  uid: string
  email: string | null
  displayName: string | null
  photoURL?: string | null
  getIdToken?: () => Promise<string>
}
type Row = Record<string, unknown>
const ts = (value: unknown) =>
  Timestamp.fromDate(value ? new Date(String(value)) : new Date())
const nullableTs = (value: unknown) => (value ? ts(value) : null)
const client = () => getSupabaseBrowserClient()

async function serverAction<T>(action: string, payload: Row): Promise<T> {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sign in again to continue.')
  const response = await fetch('/api/supabase-data', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ action, ...payload }),
  })
  const body = (await response.json()) as { result?: T; error?: string }
  if (!response.ok)
    throw new Error(body.error ?? 'The database operation failed.')
  return body.result as T
}

function mapClub(row: Row): ClubDoc {
  return {
    id: String(row.id),
    name: String(row.name),
    managerUid: String(row.manager_uid),
    managerEmail: row.manager_email as string | null,
    managerDisplayName: row.manager_display_name as string | null,
    createdAt: ts(row.created_at),
    activeSeasonNumber: Number(row.active_season_number),
    active: Boolean(row.active),
    universal: Boolean(row.universal),
  }
}
function mapMember(row: Row): ClubMembershipDoc {
  return {
    clubId: String(row.club_id),
    clubName: String(row.club_name ?? ''),
    uid: String(row.firebase_uid),
    email: row.email as string | null,
    displayName: row.display_name as string | null,
    photoURL: row.photo_url as string | null,
    role: row.role as 'manager' | 'member',
    universal: Boolean(row.universal),
    joinedAt: ts(row.joined_at),
    active: Boolean(row.active),
  }
}
function mapPlayer(row: Row): PlayerDoc {
  return {
    id: String(row.id),
    displayName: String(row.display_name),
    title: String(row.title),
    icon: String(row.icon),
    iconKey: row.icon_key as string | null,
    authUid: row.auth_uid as string | null,
    createdAt: ts(row.created_at),
    active: Boolean(row.active),
  }
}
function mapStats(row: Row): PlayerStatsDoc & { id: string } {
  return {
    id: String(row.player_id),
    playerId: String(row.player_id),
    ...(row.season_number == null
      ? {}
      : { seasonNumber: Number(row.season_number) }),
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
    eloGamesPlayed: Number(row.elo_games_played ?? row.games_played),
    eloRank: Number(row.elo_rank),
    pointsRank: Number(row.points_rank),
    last5EloDelta: Number(row.last5_elo_delta),
    playoffSeedScore:
      row.playoff_seed_score == null
        ? undefined
        : Number(row.playoff_seed_score),
    recentEloDeltas: (row.recent_elo_deltas as number[] | null) ?? [],
    skillMu: Number(row.skill_mu ?? 25),
    skillSigma: Number(row.skill_sigma ?? 25 / 3),
    skillRating: Number(row.skill_rating ?? 1500),
    skillPeak: Number(row.skill_peak ?? 1500),
    skillGamesPlayed: Number(row.skill_games_played ?? 0),
    skillRank: Number(row.skill_rank ?? 0),
    last5SkillDelta: Number(row.last5_skill_delta ?? 0),
    recentSkillDeltas: (row.recent_skill_deltas as number[] | null) ?? [],
    daysAttended: Number(row.days_attended),
    lastPlayedAt: row.last_played_at as string | null,
    updatedAt: ts(row.updated_at),
  }
}
function mapSession(row: Row): SessionDoc {
  const participants = (row.participants as string[]) ?? []
  const tableCount = Number(row.table_count)
  const rawTables = (row.tables as Record<string, string[]>) ?? {}
  const { tables, sideline } = normalizeSessionLayout(
    participants,
    tableCount,
    rawTables,
    (row.sideline as string[]) ?? [],
  )
  return {
    id: String(row.id),
    createdAt: ts(row.created_at),
    createdBy: String(row.created_by),
    seasonNumber: Number(row.season_number),
    isActive: Boolean(row.is_active),
    tableCount,
    participants,
    tables,
    sideline,
    closedAt: nullableTs(row.closed_at),
  }
}
function mapGame(row: Row): GameDoc {
  const rawEntries = (row.game_entries ?? row.entries ?? []) as Array<Row>
  return {
    id: String(row.id),
    datetime: ts(row.played_at),
    createdBy: String(row.created_by),
    seasonNumber: Number(row.season_number),
    tableId: row.table_id as string | null,
    entries: rawEntries.map((entry) => ({
      playerId: String(entry.player_id),
      score: Number(entry.score),
    })),
    winType: row.win_type as GameDoc['winType'],
    winnerPlayerId: row.winner_player_id as string | null,
    loserPlayerId: row.loser_player_id as string | null,
    fan: row.fan == null ? null : Number(row.fan),
    notes: row.notes as string | null,
  }
}
function mapSkill(row: Row): SkillEventDoc {
  return {
    id: String(row.id),
    gameId: String(row.game_id),
    playerId: String(row.player_id),
    datetime: ts(row.occurred_at),
    seasonNumber: Number(row.season_number),
    ratingBefore: Number(row.rating_before),
    ratingAfter: Number(row.rating_after),
    delta: Number(row.delta),
    mu: Number(row.mu),
    sigma: Number(row.sigma),
  }
}

function realtime<T>(
  name: string,
  table: string,
  filter: string,
  load: () => Promise<T>,
  callback: (value: T) => void,
  onError?: (error: Error) => void,
) {
  let active = true
  let running = false
  let rerun = false
  let timer: ReturnType<typeof setTimeout> | undefined
  const run = async () => {
    if (running) {
      rerun = true
      return
    }
    running = true
    try {
      const value = await load()
      if (active) callback(value)
    } catch (error) {
      if (active) onError?.(error as Error)
    } finally {
      running = false
      if (rerun && active) {
        rerun = false
        refresh()
      }
    }
  }
  const refresh = () => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      void run()
    }, 40)
  }
  void run()
  const supabase = client()
  const channel = supabase
    .channel(realtimeChannelName(name))
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter },
      refresh,
    )
    .subscribe()
  return () => {
    active = false
    if (timer) clearTimeout(timer)
    void supabase.removeChannel(channel)
  }
}

export const createClub = (input: { name: string; user: UserLike }) =>
  serverAction<string>('createClub', { name: input.name, user: input.user })
export const getCreatedClubCount = () =>
  serverAction<number>('getCreatedClubCount', {})
export const getAccountDeletionPlan = () =>
  serverAction<AccountDeletionPlan>('getAccountDeletionPlan', {})
export const deleteAccount = (
  confirmationName: string,
  managerResolutions: Record<string, AccountManagerResolution>,
) =>
  serverAction<void>('deleteAccount', {
    confirmationName,
    managerResolutions,
  })
async function getClub(clubId: string) {
  const { data, error } = await client()
    .from('clubs')
    .select('*')
    .eq('id', clubId.toUpperCase())
    .maybeSingle()
  if (error) throw error
  return data ? mapClub(data) : null
}
export function subscribeClub(
  clubId: string,
  callback: (club: ClubDoc | null) => void,
) {
  return realtime(
    `club:${clubId}`,
    'clubs',
    `id=eq.${clubId}`,
    () => getClub(clubId),
    callback,
  )
}
export function subscribeUserClubs(
  uid: string,
  callback: (clubs: ClubMembershipDoc[]) => void,
  onError?: (error: Error) => void,
) {
  const load = async () => {
    const { data, error } = await client()
      .from('user_clubs')
      .select('*')
      .eq('firebase_uid', uid)
      .eq('active', true)
      .order('club_name')
    if (error) throw error
    return (data ?? []).map(mapMember)
  }
  return realtime(
    `user-clubs:${uid}`,
    'club_members',
    `firebase_uid=eq.${uid}`,
    load,
    callback,
    onError,
  )
}
export const promoteManagerByEmail = (clubId: string, email: string) =>
  serverAction<{ status: 'promoted' | 'pending'; email: string }>(
    'promoteManagerByEmail',
    { clubId, email },
  )
export function subscribeClubMembers(
  clubId: string,
  callback: (members: ClubMembershipDoc[]) => void,
) {
  const load = async () => {
    const { data, error } = await client()
      .from('club_members')
      .select('*, clubs(name)')
      .eq('club_id', clubId)
      .eq('active', true)
    if (error) throw error
    return (data ?? [])
      .map((row: Row) =>
        mapMember({ ...row, club_name: (row.clubs as Row)?.name }),
      )
      .sort((a, b) =>
        (a.displayName ?? a.email ?? '').localeCompare(
          b.displayName ?? b.email ?? '',
        ),
      )
  }
  return realtime(
    `members:${clubId}`,
    'club_members',
    `club_id=eq.${clubId}`,
    load,
    callback,
  )
}
export const requestToJoinClub = (input: {
  clubId: string
  user: UserLike
  appUrl?: string
}) =>
  serverAction<'requested' | 'already-member'>('requestToJoinClub', {
    clubId: input.clubId,
    user: input.user,
    appUrl: input.appUrl,
  })
export function subscribeJoinRequests(
  clubId: string,
  callback: (requests: JoinRequestDoc[]) => void,
) {
  const load = async () => {
    const { data, error } = await client()
      .from('join_requests')
      .select('*')
      .eq('club_id', clubId)
      .eq('status', 'pending')
      .order('created_at')
    if (error) throw error
    return (data ?? []).map((row: Row) => ({
      id: String(row.firebase_uid),
      clubId: String(row.club_id),
      uid: String(row.firebase_uid),
      email: row.email as string | null,
      displayName: row.display_name as string | null,
      photoURL: row.photo_url as string | null,
      status: row.status as JoinRequestDoc['status'],
      createdAt: ts(row.created_at),
      resolvedAt: nullableTs(row.resolved_at),
      resolvedBy: row.resolved_by as string | null,
    }))
  }
  return realtime(
    `requests:${clubId}`,
    'join_requests',
    `club_id=eq.${clubId}`,
    load,
    callback,
  )
}
export const resolveJoinRequest = (input: {
  clubId: string
  request: JoinRequestDoc
  approved: boolean
  managerUid: string
  clubName: string
}) => serverAction<void>('resolveJoinRequest', input as unknown as Row)
export const leaveClub = (input: { clubId: string; uid: string }) =>
  serverAction<void>('leaveClub', input)
export const createPlayer = (
  clubId: string,
  input: { displayName: string; icon?: string; authUid?: string | null },
) => serverAction<string>('createPlayer', { clubId, input })
export const removePlayer = (clubId: string, playerId: string) =>
  serverAction<void>('removePlayer', { clubId, playerId })
export const setPlayerAuthLink = (
  clubId: string,
  playerId: string,
  uid: string,
  linked: boolean,
) => serverAction<void>('setPlayerAuthLink', { clubId, playerId, uid, linked })
export const updatePlayerIcon = (
  clubId: string,
  playerId: string,
  nextIcon: string,
) => serverAction<void>('updatePlayerIcon', { clubId, playerId, nextIcon })
export const updatePlayerName = (
  clubId: string,
  playerId: string,
  nextName: string,
) => serverAction<void>('updatePlayerName', { clubId, playerId, nextName })
export const deleteClub = (clubId: string) =>
  serverAction<void>('deleteClub', { clubId })
export async function createGame(clubId: string, input: Row) {
  const gameId = await serverAction<string>('createGame', { clubId, input })
  invalidateClubHistoryCache(clubId)
  return gameId
}
export async function importGames(clubId: string, input: Row) {
  await serverAction<void>('importGames', { clubId, input })
  invalidateClubHistoryCache(clubId)
}

export function subscribePlayers(
  clubId: string,
  callback: (players: PlayerDoc[]) => void,
) {
  const load = async () => {
    const { data, error } = await client()
      .from('players')
      .select('*')
      .eq('club_id', clubId)
      .eq('active', true)
      .order('display_name')
    if (error) throw error
    return (data ?? []).map(mapPlayer)
  }
  return realtime(
    `players:${clubId}`,
    'players',
    `club_id=eq.${clubId}`,
    load,
    callback,
  )
}
const historyCache = new Map<string, { expires: number; value: unknown[] }>()
const DATABASE_PAGE_SIZE = 1000
async function cached<T>(key: string, load: () => Promise<T[]>) {
  const hit = historyCache.get(key)
  if (hit && hit.expires > Date.now()) return hit.value as T[]
  const value = await load()
  historyCache.set(key, { expires: Date.now() + 300_000, value })
  return value
}
export function invalidateClubHistoryCache(clubId: string) {
  for (const key of historyCache.keys())
    if (key.startsWith(`${clubId}:`)) historyCache.delete(key)
}
async function fetchGames(
  clubId: string,
  ascending = true,
  limit?: number,
  beforeMillis?: number,
) {
  const makeQuery = () => {
    let query = client()
      .from('games')
      .select('*, game_entries(player_id,score)')
      .eq('club_id', clubId)
      .order('played_at', { ascending })
      .order('id', { ascending })
    if (beforeMillis)
      query = query.lt('played_at', new Date(beforeMillis).toISOString())
    return query
  }
  if (limit) {
    const { data, error } = await makeQuery().limit(limit)
    if (error) throw error
    return (data ?? []).map(mapGame)
  }
  const rows: Row[] = []
  for (let from = 0; ; from += DATABASE_PAGE_SIZE) {
    const { data, error } = await makeQuery().range(
      from,
      from + DATABASE_PAGE_SIZE - 1,
    )
    if (error) throw error
    rows.push(...((data ?? []) as Row[]))
    if ((data?.length ?? 0) < DATABASE_PAGE_SIZE) break
  }
  return rows.map(mapGame)
}
export function loadGamesPage(
  clubId: string,
  pageSize = 100,
  beforeMillis?: number,
) {
  return cached(`${clubId}:page:${pageSize}:${beforeMillis ?? ''}`, async () =>
    (await fetchGames(clubId, false, pageSize, beforeMillis)).reverse(),
  )
}
export function loadAllGames(clubId: string) {
  return cached(`${clubId}:all`, () => fetchGames(clubId))
}
export async function loadAnalyticsGames(
  clubId: string,
  gameCount: number,
  seasonNumber?: number,
) {
  const games = gameCount
    ? await loadGamesPage(clubId, Math.max(gameCount * 2, gameCount + 25))
    : await loadAllGames(clubId)
  return games
    .filter((game) => !seasonNumber || game.seasonNumber === seasonNumber)
    .slice(gameCount ? -gameCount : 0)
}
export async function loadAnalyticsSkillEvents(
  clubId: string,
  gameCount: number,
  seasonNumber?: number,
) {
  const makeQuery = (ascending: boolean) => {
    let query = client()
      .from('skill_events')
      .select('*')
      .eq('club_id', clubId)
      .order('occurred_at', { ascending })
      .order('id', { ascending })
    if (seasonNumber) query = query.eq('season_number', seasonNumber)
    return query
  }
  let rows: Row[] = []
  if (gameCount) {
    const { data, error } = await makeQuery(false).limit(
      Math.max(gameCount * 8, 200),
    )
    if (error) throw error
    rows = (data ?? []) as Row[]
  } else {
    for (let from = 0; ; from += DATABASE_PAGE_SIZE) {
      const { data, error } = await makeQuery(true).range(
        from,
        from + DATABASE_PAGE_SIZE - 1,
      )
      if (error) throw error
      rows.push(...((data ?? []) as Row[]))
      if ((data?.length ?? 0) < DATABASE_PAGE_SIZE) break
    }
  }
  const values = rows.map(mapSkill)
  return gameCount ? values.reverse() : values
}
export async function getClubGameCount(clubId: string) {
  const { count, error } = await client()
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', clubId)
  if (error) throw error
  return count ?? 0
}
export function subscribePlayerStats(
  clubId: string,
  callback: (stats: Array<PlayerStatsDoc & { id: string }>) => void,
  seasonNumber?: number,
) {
  const table = seasonNumber ? 'season_player_stats' : 'player_stats'
  const load = async () => {
    let query = client().from(table).select('*').eq('club_id', clubId)
    if (seasonNumber) query = query.eq('season_number', seasonNumber)
    const { data, error } = await query
    if (error) throw error
    let stats = (data ?? []).map(mapStats)
    const ranks = computeGlobalRanks(stats)
    const skillRanks = new Map(
      [...stats]
        .sort((a, b) => b.skillRating - a.skillRating)
        .map((stat, index) => [stat.playerId, index + 1]),
    )
    stats = stats.map((stat) => ({
      ...stat,
      eloRank: ranks.eloRanks[stat.playerId] ?? 0,
      pointsRank: ranks.pointsRanks[stat.playerId] ?? 0,
      skillRank: skillRanks.get(stat.playerId) ?? 0,
    }))
    return stats.sort((a, b) => a.skillRank - b.skillRank)
  }
  return realtime(
    `stats:${clubId}:${seasonNumber ?? 'all'}`,
    table,
    `club_id=eq.${clubId}`,
    load,
    callback,
  )
}
export function subscribeSeasons(
  clubId: string,
  callback: (seasons: SeasonDoc[]) => void,
) {
  const load = async () => {
    const { data, error } = await client()
      .from('seasons')
      .select('*')
      .eq('club_id', clubId)
      .order('season_number')
    if (error) throw error
    return (data ?? []).map((row: Row) => ({
      id: String(row.season_number),
      seasonNumber: Number(row.season_number),
      name: String(row.name),
      createdAt: ts(row.created_at),
      createdBy: String(row.created_by),
      active: Boolean(row.active),
    }))
  }
  return realtime(
    `seasons:${clubId}`,
    'seasons',
    `club_id=eq.${clubId}`,
    load,
    callback,
  )
}
export const ensureSeasons = (clubId: string, userId = 'system') =>
  serverAction<void>('ensureSeasons', { clubId, userId })
export const startNewSeason = (clubId: string, input: { createdBy: string }) =>
  serverAction<number>('startNewSeason', { clubId, input })
export const setActiveSeason = (clubId: string, seasonNumber: number) =>
  serverAction<void>('setActiveSeason', { clubId, seasonNumber })
export function subscribeActiveSession(
  clubId: string,
  seasonNumber: number,
  callback: (session: SessionDoc | null) => void,
  onError?: (error: Error) => void,
) {
  const load = async () => {
    const { data, error } = await client()
      .from('sessions')
      .select('*')
      .eq('club_id', clubId)
      .eq('season_number', seasonNumber)
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data ? mapSession(data) : null
  }
  return realtime(
    `session:${clubId}:${seasonNumber}`,
    'sessions',
    `club_id=eq.${clubId}`,
    load,
    callback,
    onError,
  )
}
export async function createSession(
  clubId: string,
  input: {
    createdBy: string
    participants: string[]
    tableCount: number
    seasonNumber: number
    tables?: Record<string, string[]>
    sideline?: string[]
  },
) {
  const initialLayout = createInitialSessionLayout(
    input.participants,
    input.tableCount,
  )
  const tables = input.tables ?? initialLayout.tables
  const assigned = new Set(Object.values(tables).flat())
  const sideline =
    input.sideline ??
    initialLayout.sideline.filter((playerId) => !assigned.has(playerId))
  return serverAction<string>('createSession', {
    clubId,
    input: { ...input, tables, sideline },
  })
}
export async function updateSession(
  clubId: string,
  sessionId: string,
  values: Partial<Omit<SessionDoc, 'id' | 'createdAt' | 'createdBy'>>,
) {
  const mapped: Row = {}
  if (values.seasonNumber != null) mapped.season_number = values.seasonNumber
  if (values.isActive != null) mapped.is_active = values.isActive
  if (values.tableCount != null) mapped.table_count = values.tableCount
  if (values.participants) mapped.participants = values.participants
  if (values.tables) mapped.tables = values.tables
  if (values.sideline) mapped.sideline = values.sideline
  if (values.closedAt !== undefined)
    mapped.closed_at = values.closedAt?.toDate().toISOString() ?? null
  const { error } = await client()
    .from('sessions')
    .update(mapped)
    .eq('id', sessionId)
    .eq('club_id', clubId)
  if (error) throw error
}
export const closeSession = (clubId: string, sessionId: string) =>
  updateSession(clubId, sessionId, {
    isActive: false,
    closedAt: Timestamp.now(),
  })
export const ensureConfig = (clubId: string) =>
  serverAction<void>('ensureConfig', { clubId })
export async function getSoundPreference(uid: string) {
  const { data, error } = await client()
    .from('user_profiles')
    .select('sound_enabled')
    .eq('firebase_uid', uid)
    .maybeSingle()
  if (error) throw error
  return data?.sound_enabled as boolean | undefined
}
export async function setSoundPreference(uid: string, enabled: boolean) {
  const user = auth.currentUser
  const { error } = await client()
    .from('user_profiles')
    .upsert({
      firebase_uid: uid,
      email: user?.email ?? null,
      display_name: user?.displayName ?? null,
      photo_url: user?.photoURL ?? null,
      sound_enabled: enabled,
      updated_at: new Date().toISOString(),
    })
  if (error) throw error
}
export async function claimMingWelcome(uid: string) {
  const { data, error } = await client()
    .from('user_profiles')
    .update({
      ming_welcome_seen_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('firebase_uid', uid)
    .is('ming_welcome_seen_at', null)
    .select('firebase_uid')
  if (error) throw error
  return Boolean(data?.length)
}
