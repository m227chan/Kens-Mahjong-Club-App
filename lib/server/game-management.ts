import 'server-only'
import { Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '@/lib/firebase-admin'
import { calculateRoundEloDeltas, computeGlobalRanks, type AppConfigLike } from '@/lib/stats-engine'

type Entry = { playerId: string; score: number }
type StoredGame = {
  id: string
  datetime: Timestamp
  createdBy: string
  seasonNumber?: number
  tableId?: string | null
  entries: Entry[]
  winType?: 'self_draw' | 'discard' | 'draw'
  winnerPlayerId?: string | null
  loserPlayerId?: string | null
  fan?: number | null
  notes?: string | null
}
type Stats = {
  playerId: string; seasonNumber?: number; totalPoints: number; gamesPlayed: number; gamesWon: number; gamesLost: number
  winLossRatio: number; bestSingleGame: number; worstSingleGame: number; eloRating: number; eloPeak: number
  eloRank: number; pointsRank: number; last5EloDelta: number; recentEloDeltas: number[]; daysAttended: number
  lastPlayedAt: string | null; updatedAt: Timestamp
}

const pathOf = (...parts: string[]) => parts.join('/')

async function requireManager(clubId: string, uid: string) {
  const member = await adminDb.doc(pathOf('clubs', clubId, 'members', uid)).get()
  if (!member.exists || member.get('active') !== true || member.get('role') !== 'manager') {
    throw new Error('Only an active club manager can modify game records.')
  }
}

function validateEntries(entries: Entry[]) {
  if (entries.length !== 4 || new Set(entries.map((entry) => entry.playerId)).size !== 4) {
    throw new Error('A game must contain four different players.')
  }
  if (entries.some((entry) => !entry.playerId || !Number.isFinite(entry.score))) throw new Error('Every score must be a valid number.')
  if (entries.reduce((sum, entry) => sum + entry.score, 0) !== 0) throw new Error('Game scores must add up to zero.')
}

export async function mutateGameAndRebuild(input: {
  callerUid: string
  clubId: string
  gameId: string
  action: 'update' | 'delete'
  game?: { datetime: string; seasonNumber: number; entries: Entry[]; notes?: string | null }
}) {
  const clubId = input.clubId.trim().toUpperCase()
  if (!clubId || !input.gameId) throw new Error('Club and game are required.')
  await requireManager(clubId, input.callerUid)

  const root = adminDb.doc(pathOf('clubs', clubId))
  const [gamesSnap, configSnap, oldStats, oldSeasonStats, oldEvents] = await Promise.all([
    root.collection('games').orderBy('datetime').get(),
    root.collection('appConfig').doc('settings').get(),
    root.collection('playerStats').get(),
    root.collection('seasonPlayerStats').get(),
    root.collection('eloEvents').get()
  ])
  const target = gamesSnap.docs.find((doc) => doc.id === input.gameId)
  if (!target) throw new Error('Game not found.')

  let replacement: StoredGame | null = null
  if (input.action === 'update') {
    if (!input.game) throw new Error('Updated game data is required.')
    validateEntries(input.game.entries)
    const date = new Date(input.game.datetime)
    if (!Number.isFinite(date.getTime())) throw new Error('Enter a valid game date and time.')
    const seasonNumber = Math.max(1, Math.floor(input.game.seasonNumber))
    const current = { id: target.id, ...target.data() } as StoredGame
    const winner = input.game.entries.every((entry) => entry.score === 0)
      ? null
      : input.game.entries.reduce((best, entry) => entry.score > best.score ? entry : best).playerId
    replacement = {
      ...current,
      datetime: Timestamp.fromDate(date),
      seasonNumber,
      entries: input.game.entries,
      notes: input.game.notes?.trim() || null,
      winType: winner ? (current.winType === 'discard' ? 'discard' : 'self_draw') : 'draw',
      winnerPlayerId: winner,
      loserPlayerId: current.winType === 'discard' && input.game.entries.some((entry) => entry.playerId === current.loserPlayerId)
        ? current.loserPlayerId ?? null
        : null
    }
  }

  const games = gamesSnap.docs
    .filter((doc) => input.action !== 'delete' || doc.id !== input.gameId)
    .map((doc) => doc.id === input.gameId && replacement ? replacement : ({ id: doc.id, ...doc.data() } as StoredGame))
    .sort((a, b) => a.datetime.toMillis() - b.datetime.toMillis())
  const config = (configSnap.exists ? configSnap.data() : {}) as AppConfigLike
  const startingRating = config.eloStartingRating ?? 1500
  const now = Timestamp.now()
  const makeStats = (playerId: string, seasonNumber?: number): Stats => ({
    playerId, ...(seasonNumber === undefined ? {} : { seasonNumber }), totalPoints: 0, gamesPlayed: 0, gamesWon: 0, gamesLost: 0,
    winLossRatio: 0, bestSingleGame: Number.NEGATIVE_INFINITY, worstSingleGame: Number.POSITIVE_INFINITY,
    eloRating: startingRating, eloPeak: startingRating, eloRank: 0, pointsRank: 0, last5EloDelta: 0,
    recentEloDeltas: [], daysAttended: 0, lastPlayedAt: null, updatedAt: now
  })
  const allStats = new Map<string, Stats>()
  const seasonStats = new Map<string, Stats>()
  const events: Array<Record<string, unknown>> = []

  const applyGame = (map: Map<string, Stats>, keyFor: (id: string) => string, game: StoredGame, seasonNumber?: number) => {
    const round = game.entries.map((entry) => {
      const current = map.get(keyFor(entry.playerId)) ?? makeStats(entry.playerId, seasonNumber)
      return { playerId: entry.playerId, score: entry.score, ratingBefore: current.eloRating, gamesPlayed: current.gamesPlayed }
    })
    const results = calculateRoundEloDeltas(round, config)
    game.entries.forEach((entry) => {
      const key = keyFor(entry.playerId)
      const current = map.get(key) ?? makeStats(entry.playerId, seasonNumber)
      const result = results.find((item) => item.playerId === entry.playerId)!
      const day = game.datetime.toDate().toISOString().slice(0, 10)
      const recent = [...current.recentEloDeltas, result.delta].slice(-5)
      const wins = current.gamesWon + (entry.score > 0 ? 1 : 0)
      const losses = current.gamesLost + (entry.score < 0 ? 1 : 0)
      map.set(key, { ...current, totalPoints: current.totalPoints + entry.score, gamesPlayed: current.gamesPlayed + 1,
        gamesWon: wins, gamesLost: losses, winLossRatio: wins / Math.max(1, losses),
        bestSingleGame: Math.max(current.bestSingleGame, entry.score), worstSingleGame: Math.min(current.worstSingleGame, entry.score),
        eloRating: result.ratingAfter, eloPeak: Math.max(current.eloPeak, result.ratingAfter),
        last5EloDelta: recent.reduce((sum, delta) => sum + delta, 0), recentEloDeltas: recent,
        daysAttended: current.daysAttended + (current.lastPlayedAt === day ? 0 : 1), lastPlayedAt: day, updatedAt: now })
    })
    return results
  }

  games.forEach((game) => {
    applyGame(allStats, (id) => id, game)
    const season = game.seasonNumber ?? 1
    const results = applyGame(seasonStats, (id) => `${season}_${id}`, game, season)
    results.forEach((result) => events.push({ gameId: game.id, playerId: result.playerId, datetime: game.datetime, seasonNumber: season,
      ratingBefore: result.ratingBefore, ratingAfter: result.ratingAfter, delta: result.delta, kFactor: result.kFactor,
      marginMultiplier: result.marginMultiplier, opponents: result.opponents }))
  })

  const rank = (items: Stats[]) => {
    const ranks = computeGlobalRanks(items)
    items.forEach((stats) => { stats.eloRank = ranks.eloRanks[stats.playerId] ?? 0; stats.pointsRank = ranks.pointsRanks[stats.playerId] ?? 0 })
  }
  rank([...allStats.values()])
  new Set([...seasonStats.values()].map((stats) => stats.seasonNumber ?? 1)).forEach((season) => rank([...seasonStats.values()].filter((stats) => stats.seasonNumber === season)))

  const writes: Array<(batch: FirebaseFirestore.WriteBatch) => void> = []
  oldStats.docs.forEach((doc) => writes.push((batch) => batch.delete(doc.ref)))
  oldSeasonStats.docs.forEach((doc) => writes.push((batch) => batch.delete(doc.ref)))
  oldEvents.docs.forEach((doc) => writes.push((batch) => batch.delete(doc.ref)))
  allStats.forEach((stats, id) => writes.push((batch) => batch.set(root.collection('playerStats').doc(id), stats)))
  seasonStats.forEach((stats, id) => writes.push((batch) => batch.set(root.collection('seasonPlayerStats').doc(id), stats)))
  events.forEach((event) => writes.push((batch) => { const ref = root.collection('eloEvents').doc(); batch.set(ref, { ...event, id: ref.id }) }))
  if (input.action === 'delete') writes.push((batch) => batch.delete(target.ref))
  else writes.push((batch) => batch.set(target.ref, replacement!, { merge: false }))

  for (let index = 0; index < writes.length; index += 400) {
    const batch = adminDb.batch()
    writes.slice(index, index + 400).forEach((write) => write(batch))
    await batch.commit()
  }
  return { action: input.action, gameId: input.gameId }
}
