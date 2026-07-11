import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  setDoc,
  Timestamp,
  where,
  writeBatch
} from 'firebase/firestore'
import type { DocumentData, DocumentReference } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { assignSeats, assignTitle, calculateRoundEloDeltas, computeGlobalRanks, type AppConfigLike } from '@/lib/stats-engine'
import type {
  AppConfigDoc,
  ClubDoc,
  ClubMembershipDoc,
  EloEventDoc,
  GameDoc,
  JoinRequestDoc,
  PlayerDoc,
  PlayerStatsDoc,
  SeasonDoc,
  SessionDoc,
  TableArrangementDoc
} from '@/lib/types'

type UserLike = {
  uid: string
  email: string | null
  displayName: string | null
  photoURL?: string | null
  getIdToken?: () => Promise<string>
}

type ImportGameInput = {
  datetime?: Timestamp
  seasonNumber: number
  entries: Array<{ playerId: string; score: number }>
  notes?: string | null
}

function clubCollection(clubId: string, collectionName: string) {
  return collection(db, 'clubs', clubId, collectionName)
}

function clubDoc(clubId: string, collectionName: string, docId: string) {
  return doc(db, 'clubs', clubId, collectionName, docId)
}

function generateClubId() {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 6 }, () => alphabet[Math.floor(Math.random() * alphabet.length)]).join('')
}

function normalizePlayerIcon(value: string | undefined, fallback: string) {
  return (value?.trim() || fallback).slice(0, 12)
}

function playerIconKey(value: string) {
  return encodeURIComponent(value.trim().toLocaleLowerCase())
}

export async function createClub(input: { name: string; user: UserLike }) {
  const cleanName = input.name.trim()
  if (!cleanName) {
    throw new Error('Enter a club name.')
  }

  let clubId = generateClubId()
  let clubRef = doc(db, 'clubs', clubId)
  for (let attempts = 0; attempts < 5; attempts += 1) {
    const existing = await getDoc(clubRef)
    if (!existing.exists()) break
    clubId = generateClubId()
    clubRef = doc(db, 'clubs', clubId)
  }

  const now = Timestamp.now()
  const club: ClubDoc = {
    id: clubId,
    name: cleanName,
    managerUid: input.user.uid,
    managerEmail: input.user.email,
    managerDisplayName: input.user.displayName,
    createdAt: now,
    activeSeasonNumber: 1,
    active: true
  }

  const membership: ClubMembershipDoc = {
    clubId,
    clubName: cleanName,
    uid: input.user.uid,
    email: input.user.email,
    displayName: input.user.displayName,
    photoURL: input.user.photoURL ?? null,
    role: 'manager',
    joinedAt: now,
    active: true
  }

  const batch = writeBatch(db)
  batch.set(clubRef, club)
  batch.set(clubDoc(clubId, 'members', input.user.uid), membership)
  batch.set(doc(db, 'users', input.user.uid, 'clubs', clubId), membership)
  batch.set(clubDoc(clubId, 'seasons', '1'), {
    id: '1',
    seasonNumber: 1,
    name: 'Season 1',
    createdAt: now,
    createdBy: input.user.uid,
    active: true
  } as SeasonDoc)
  await batch.commit()

  return clubId
}

export function subscribeClub(clubId: string, callback: (club: ClubDoc | null) => void) {
  return onSnapshot(doc(db, 'clubs', clubId), (snapshot) => {
    callback(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as ClubDoc) : null)
  })
}

export function subscribeUserClubs(
  uid: string,
  callback: (clubs: ClubMembershipDoc[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(collection(db, 'users', uid, 'clubs'), where('active', '==', true))
  return onSnapshot(q, (snapshot) => {
    const clubs = snapshot.docs
      .map((docSnap) => docSnap.data() as ClubMembershipDoc)
      .sort((a, b) => a.clubName.localeCompare(b.clubName))
    callback(clubs)
  }, onError)
}

export function subscribeClubMembers(clubId: string, callback: (members: ClubMembershipDoc[]) => void) {
  const q = query(clubCollection(clubId, 'members'), where('active', '==', true))
  return onSnapshot(q, (snapshot) => {
    const members = snapshot.docs
      .map((docSnap) => docSnap.data() as ClubMembershipDoc)
      .sort((a, b) => (a.displayName ?? a.email ?? '').localeCompare(b.displayName ?? b.email ?? ''))
    callback(members)
  })
}

export async function getClub(clubId: string) {
  const snap = await getDoc(doc(db, 'clubs', clubId.toUpperCase()))
  return snap.exists() ? ({ id: snap.id, ...snap.data() } as ClubDoc) : null
}

export async function requestToJoinClub(input: { clubId: string; user: UserLike; appUrl?: string }) {
  const clubId = input.clubId.trim().toUpperCase()
  const club = await getClub(clubId)
  if (!club) {
    throw new Error('No club found with that ID.')
  }

  const existingMember = await getDoc(clubDoc(clubId, 'members', input.user.uid))
  if (existingMember.exists() && (existingMember.data() as ClubMembershipDoc).active) {
    return 'already-member'
  }

  const requestRef = clubDoc(clubId, 'joinRequests', input.user.uid)
  const request: JoinRequestDoc = {
    id: input.user.uid,
    clubId,
    uid: input.user.uid,
    email: input.user.email,
    displayName: input.user.displayName,
    photoURL: input.user.photoURL ?? null,
    status: 'pending',
    createdAt: Timestamp.now(),
    resolvedAt: null,
    resolvedBy: null
  }

  const batch = writeBatch(db)
  batch.set(requestRef, request, { merge: true })

  await batch.commit()

  if (club.managerEmail && input.user.getIdToken) {
    try {
      const token = await input.user.getIdToken()
      const response = await fetch('/api/send-join-request-email', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ clubId, appUrl: input.appUrl ?? '' })
      })

      if (!response.ok) {
        console.warn('Join request email was not sent.', await response.text())
      }
    } catch (error) {
      console.warn('Join request email was not sent.', error)
    }
  }

  return 'requested'
}

export function subscribeJoinRequests(clubId: string, callback: (requests: JoinRequestDoc[]) => void) {
  const q = query(clubCollection(clubId, 'joinRequests'), where('status', '==', 'pending'))
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as JoinRequestDoc)))
  })
}

export async function resolveJoinRequest(input: { clubId: string; request: JoinRequestDoc; approved: boolean; managerUid: string; clubName: string }) {
  const now = Timestamp.now()
  const batch = writeBatch(db)

  batch.set(clubDoc(input.clubId, 'joinRequests', input.request.uid), {
    status: input.approved ? 'approved' : 'declined',
    resolvedAt: now,
    resolvedBy: input.managerUid
  }, { merge: true })

  if (input.approved) {
    const membership: ClubMembershipDoc = {
      clubId: input.clubId,
      clubName: input.clubName,
      uid: input.request.uid,
      email: input.request.email,
      displayName: input.request.displayName,
      photoURL: input.request.photoURL ?? null,
      role: 'member',
      joinedAt: now,
      active: true
    }

    batch.set(clubDoc(input.clubId, 'members', input.request.uid), membership)
    batch.set(doc(db, 'users', input.request.uid, 'clubs', input.clubId), membership)
  }

  await batch.commit()
}

export async function leaveClub(input: { clubId: string; uid: string }) {
  const memberSnap = await getDoc(clubDoc(input.clubId, 'members', input.uid))
  if (memberSnap.exists() && (memberSnap.data() as ClubMembershipDoc).role === 'manager') {
    throw new Error('Club managers cannot leave their club yet.')
  }

  const batch = writeBatch(db)
  batch.set(clubDoc(input.clubId, 'members', input.uid), { active: false }, { merge: true })
  batch.set(doc(db, 'users', input.uid, 'clubs', input.clubId), { active: false }, { merge: true })
  await batch.commit()
}

export async function createPlayer(clubId: string, input: { displayName: string; icon?: string; authUid?: string | null }) {
  const displayName = input.displayName.trim()
  if (!displayName) {
    throw new Error('Enter a player name.')
  }

  const icon = normalizePlayerIcon(input.icon, displayName.slice(0, 1).toUpperCase() || 'M')
  const iconKey = playerIconKey(icon)
  const ref = doc(clubCollection(clubId, 'players'))
  const iconRef = clubDoc(clubId, 'playerIcons', iconKey)
  const existingPlayers = await getDocs(query(clubCollection(clubId, 'players'), where('active', '==', true)))
  if (existingPlayers.docs.some((docSnap) => playerIconKey((docSnap.data() as PlayerDoc).icon) === iconKey)) {
    throw new Error('That icon or initial is already in use in this club.')
  }

  const payload: PlayerDoc = {
    id: ref.id,
    displayName,
    title: 'Monk',
    icon,
    iconKey,
    authUid: input.authUid ?? null,
    createdAt: Timestamp.now(),
    active: true
  }

  await runTransaction(db, async (transaction) => {
    const existingIcon = await transaction.get(iconRef)
    if (existingIcon.exists()) {
      throw new Error('That icon or initial is already in use in this club.')
    }

    transaction.set(iconRef, {
      icon,
      playerId: ref.id,
      createdAt: Timestamp.now()
    })
    transaction.set(ref, payload)
  })

  return ref.id
}

export async function removePlayer(clubId: string, playerId: string) {
  const playerRef = clubDoc(clubId, 'players', playerId)
  const playerSnap = await getDoc(playerRef)
  const player = playerSnap.exists() ? playerSnap.data() as PlayerDoc : null
  const batch = writeBatch(db)

  batch.set(playerRef, { active: false }, { merge: true })

  if (player?.iconKey) {
    batch.delete(clubDoc(clubId, 'playerIcons', player.iconKey))
  }

  await batch.commit()
}

export async function updatePlayerIcon(clubId: string, playerId: string, nextIcon: string) {
  const playerRef = clubDoc(clubId, 'players', playerId)
  const next = normalizePlayerIcon(nextIcon, '🀄')
  const nextKey = playerIconKey(next)

  await runTransaction(db, async (transaction) => {
    const playerSnap = await transaction.get(playerRef)
    if (!playerSnap.exists()) throw new Error('Player not found.')
    const player = playerSnap.data() as PlayerDoc
    if (player.iconKey === nextKey) return
    const nextRef = clubDoc(clubId, 'playerIcons', nextKey)
    const existing = await transaction.get(nextRef)
    if (existing.exists()) throw new Error('That emoji is already in use in this club.')
    transaction.set(nextRef, { icon: next, playerId, createdAt: Timestamp.now() })
    transaction.update(playerRef, { icon: next, iconKey: nextKey })
    if (player.iconKey) transaction.delete(clubDoc(clubId, 'playerIcons', player.iconKey))
  })
}

export async function deleteClub(clubId: string, managerUid: string) {
  const members = await getDocs(query(clubCollection(clubId, 'members'), where('active', '==', true)))
  const batch = writeBatch(db)
  batch.set(doc(db, 'clubs', clubId), { active: false, deletedAt: Timestamp.now(), deletedBy: managerUid }, { merge: true })
  members.docs.forEach((memberDoc) => {
    const member = memberDoc.data() as ClubMembershipDoc
    batch.set(memberDoc.ref, { active: false }, { merge: true })
    batch.set(doc(db, 'users', member.uid, 'clubs', clubId), { active: false }, { merge: true })
  })
  await batch.commit()
}
export async function createGame(clubId: string, input: {
  entries: Array<{ playerId: string; score: number }>
  createdBy: string
  seasonNumber?: number
  datetime?: Timestamp
  tableId?: string | null
  notes?: string | null
  winType?: 'self_draw' | 'discard' | 'draw'
  loserPlayerId?: string | null
  fan?: number | null
}) {
  const entries = input.entries.map((entry) => ({
    playerId: entry.playerId,
    score: Number(entry.score)
  }))

  if (entries.length !== 4) {
    throw new Error('A Mahjong game must include exactly 4 players.')
  }

  const uniquePlayerIds = Array.from(new Set(entries.map((entry) => entry.playerId)))
  if (uniquePlayerIds.length !== 4) {
    throw new Error('Each player must appear exactly once in the game.')
  }

  const totalScore = entries.reduce((sum, entry) => sum + entry.score, 0)
  if (totalScore !== 0) {
    throw new Error('Scores must sum to zero for a valid Mahjong round.')
  }

  const gameRef = doc(clubCollection(clubId, 'games'))
  const gameId = gameRef.id
  const seasonNumber = Math.max(1, Math.floor(input.seasonNumber ?? 1))
  const gameDatetime = input.datetime ?? Timestamp.now()
  const gameWinType = input.winType ?? 'self_draw'
  const winnerPlayerId = gameWinType === 'draw'
    ? null
    : entries.reduce((winner, current) => current.score > winner.score ? current : winner).playerId

  await runTransaction(db, async (transaction) => {
    const configRef = clubDoc(clubId, 'appConfig', 'settings')
    const configSnap = await transaction.get(configRef)
    const config = (configSnap.exists() ? configSnap.data() : {}) as AppConfigDoc & AppConfigLike
    const defaultStartingRating = config.eloStartingRating ?? 1500

    if (gameWinType === 'discard' && !input.loserPlayerId) {
      throw new Error('Discard wins require a loser.')
    }

    const buildStatsDocs = async (collectionName: string, includeSeasonNumber: boolean) => {
      const statsRefs = uniquePlayerIds.map((playerId) => clubDoc(clubId, collectionName, includeSeasonNumber ? `${seasonNumber}_${playerId}` : playerId))
      const statsSnaps = await Promise.all(statsRefs.map((ref) => transaction.get(ref)))

      return statsSnaps.map((statsSnap, index) => {
        const playerId = uniquePlayerIds[index]
        const existing = (statsSnap.exists() ? statsSnap.data() : {}) as Partial<PlayerStatsDoc>
        const statsData: PlayerStatsDoc = {
          playerId,
          totalPoints: existing.totalPoints ?? 0,
          gamesPlayed: existing.gamesPlayed ?? 0,
          gamesWon: existing.gamesWon ?? 0,
          gamesLost: existing.gamesLost ?? 0,
          winLossRatio: existing.winLossRatio ?? 0,
          bestSingleGame: existing.bestSingleGame ?? Number.NEGATIVE_INFINITY,
          worstSingleGame: existing.worstSingleGame ?? Number.POSITIVE_INFINITY,
          eloRating: existing.eloRating ?? defaultStartingRating,
          eloPeak: existing.eloPeak ?? defaultStartingRating,
          eloRank: existing.eloRank ?? 0,
          pointsRank: existing.pointsRank ?? 0,
          last5EloDelta: existing.last5EloDelta ?? 0,
          recentEloDeltas: existing.recentEloDeltas ?? [],
          daysAttended: existing.daysAttended ?? 0,
          lastPlayedAt: existing.lastPlayedAt ?? null,
          updatedAt: Timestamp.now()
        }

        if (includeSeasonNumber) {
          statsData.seasonNumber = seasonNumber
        }

        return {
          ref: statsRefs[index],
          data: statsData
        }
      })
    }

    const updateStatsDocs = (statsDocs: Awaited<ReturnType<typeof buildStatsDocs>>) => {
      const roundEntries = entries.map((entry) => {
        const stats = statsDocs.find((stats) => stats.data.playerId === entry.playerId)!
        return {
          playerId: entry.playerId,
          score: entry.score,
          ratingBefore: stats.data.eloRating,
          gamesPlayed: stats.data.gamesPlayed
        }
      })
      const roundEloResults = calculateRoundEloDeltas(roundEntries, config)

      statsDocs.forEach((item) => {
        const result = roundEloResults.find((entry) => entry.playerId === item.data.playerId)!
        const entry = entries.find((gameEntry) => gameEntry.playerId === item.data.playerId)!
        const isWin = entry.score > 0
        const isLoss = entry.score < 0
        const gameDate = gameDatetime.toDate().toISOString().slice(0, 10)
        const playedToday = item.data.lastPlayedAt === gameDate
        const recentEloDeltas = [...(item.data.recentEloDeltas ?? []), result.delta].slice(-5)
        const nextTotalPoints = item.data.totalPoints + entry.score

        const nextStats: PlayerStatsDoc = {
          ...item.data,
          totalPoints: nextTotalPoints,
          gamesPlayed: item.data.gamesPlayed + 1,
          gamesWon: item.data.gamesWon + (isWin ? 1 : 0),
          gamesLost: item.data.gamesLost + (isLoss ? 1 : 0),
          winLossRatio: (item.data.gamesWon + (isWin ? 1 : 0)) / Math.max(1, item.data.gamesLost + (isLoss ? 1 : 0)),
          bestSingleGame: Math.max(item.data.bestSingleGame, entry.score),
          worstSingleGame: Math.min(item.data.worstSingleGame, entry.score),
          eloRating: result.ratingAfter,
          eloPeak: Math.max(item.data.eloPeak, result.ratingAfter),
          last5EloDelta: recentEloDeltas.reduce((sum, delta) => sum + delta, 0),
          recentEloDeltas,
          daysAttended: item.data.daysAttended + (playedToday ? 0 : 1),
          lastPlayedAt: gameDate,
          updatedAt: Timestamp.now()
        }

        transaction.set(item.ref, nextStats)
      })

      return roundEloResults
    }

    const allTimeStatsDocs = await buildStatsDocs('playerStats', false)
    const seasonStatsDocs = await buildStatsDocs('seasonPlayerStats', true)

    transaction.set(gameRef, {
      id: gameId,
      datetime: gameDatetime,
      createdBy: input.createdBy,
      seasonNumber,
      tableId: input.tableId ?? null,
      entries,
      winType: gameWinType,
      winnerPlayerId,
      loserPlayerId: input.winType === 'discard' ? input.loserPlayerId ?? null : null,
      fan: gameWinType === 'draw' ? null : input.fan ?? null,
      notes: input.notes ?? null
    } as GameDoc)

    updateStatsDocs(allTimeStatsDocs)
    const seasonEloResults = updateStatsDocs(seasonStatsDocs)

    const seasonTitleByPlayer = new Map(seasonStatsDocs.map((item) => {
      const entry = entries.find((gameEntry) => gameEntry.playerId === item.data.playerId)!
      return [item.data.playerId, assignTitle(item.data.totalPoints + entry.score, config.titleBands ?? [])]
    }))

    seasonEloResults.forEach((result) => {
      const eventRef = doc(clubCollection(clubId, 'eloEvents'))
      transaction.set(eventRef, {
        id: eventRef.id,
        gameId,
        playerId: result.playerId,
        datetime: gameDatetime,
        seasonNumber,
        ratingBefore: result.ratingBefore,
        ratingAfter: result.ratingAfter,
        delta: result.delta,
        kFactor: result.kFactor,
        marginMultiplier: result.marginMultiplier,
        opponents: result.opponents
      } as EloEventDoc)
    })

    seasonTitleByPlayer.forEach((title, playerId) => {
      transaction.update(clubDoc(clubId, 'players', playerId), { title })
    })
  })

  const rankStats = async (collectionName: string, season?: number) => {
    const statsQuery = season === undefined
      ? query(clubCollection(clubId, collectionName))
      : query(clubCollection(clubId, collectionName), where('seasonNumber', '==', season))
    const allStatsSnapshot = await getDocs(statsQuery)
    const allStats = allStatsSnapshot.docs.map((docSnap) => ({ ...(docSnap.data() as PlayerStatsDoc), id: docSnap.id }))
    const ranks = computeGlobalRanks(allStats)
    const rankBatch = writeBatch(db)

    allStats.forEach((stat) => {
      rankBatch.update(clubDoc(clubId, collectionName, stat.id), {
        eloRank: ranks.eloRanks[stat.playerId] ?? 0,
        pointsRank: ranks.pointsRanks[stat.playerId] ?? 0
      })
    })

    await rankBatch.commit()
  }

  await rankStats('playerStats')
  await rankStats('seasonPlayerStats', seasonNumber)
  return gameId
}

export function subscribeSeasons(clubId: string, callback: (seasons: SeasonDoc[]) => void) {
  const q = query(clubCollection(clubId, 'seasons'), orderBy('seasonNumber'))
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as SeasonDoc)))
  })
}

export async function ensureSeasons(clubId: string, userId = 'system') {
  const clubRef = doc(db, 'clubs', clubId)
  const seasonRef = clubDoc(clubId, 'seasons', '1')
  const [clubSnap, seasonSnap] = await Promise.all([getDoc(clubRef), getDoc(seasonRef)])
  const rankBatch = writeBatch(db)

  if (!seasonSnap.exists()) {
    rankBatch.set(seasonRef, {
      id: '1',
      seasonNumber: 1,
      name: 'Season 1',
      createdAt: Timestamp.now(),
      createdBy: userId,
      active: true
    } as SeasonDoc)
  }

  if (clubSnap.exists() && !(clubSnap.data() as ClubDoc).activeSeasonNumber) {
    rankBatch.set(clubRef, { activeSeasonNumber: 1 }, { merge: true })
  }

  await rankBatch.commit()
}

export async function startNewSeason(clubId: string, input: { createdBy: string }) {
  const seasonsSnap = await getDocs(query(clubCollection(clubId, 'seasons'), orderBy('seasonNumber', 'desc'), limit(1)))
  const latest = seasonsSnap.empty ? 0 : ((seasonsSnap.docs[0].data() as SeasonDoc).seasonNumber ?? 0)
  const nextSeasonNumber = latest + 1
  const batch = writeBatch(db)

  batch.set(clubDoc(clubId, 'seasons', String(nextSeasonNumber)), {
    id: String(nextSeasonNumber),
    seasonNumber: nextSeasonNumber,
    name: `Season ${nextSeasonNumber}`,
    createdAt: Timestamp.now(),
    createdBy: input.createdBy,
    active: true
  } as SeasonDoc)
  batch.set(doc(db, 'clubs', clubId), { activeSeasonNumber: nextSeasonNumber }, { merge: true })

  const activeSessions = await getDocs(query(clubCollection(clubId, 'sessions'), where('isActive', '==', true)))
  activeSessions.docs.forEach((sessionDoc) => {
    batch.set(sessionDoc.ref, { isActive: false, closedAt: Timestamp.now() }, { merge: true })
  })

  await batch.commit()
  return nextSeasonNumber
}

export async function setActiveSeason(clubId: string, seasonNumber: number) {
  await setDoc(doc(db, 'clubs', clubId), { activeSeasonNumber: seasonNumber }, { merge: true })
}

export async function importGames(clubId: string, input: {
  games: ImportGameInput[]
  createdBy: string
}) {
  if (input.games.length === 0) return

  const normalizedGames = input.games
    .map((game) => {
      const entries = game.entries.map((entry) => ({
        playerId: entry.playerId,
        score: Number(entry.score)
      }))
      const seasonNumber = Math.max(1, Math.floor(game.seasonNumber ?? 1))
      const datetime = game.datetime ?? Timestamp.now()
      return { ...game, entries, seasonNumber, datetime }
    })
    .sort((left, right) => left.datetime.toMillis() - right.datetime.toMillis())

  normalizedGames.forEach((game, index) => {
    if (game.entries.length !== 4) {
      throw new Error(`Imported game ${index + 1} must include exactly 4 players.`)
    }
    if (new Set(game.entries.map((entry) => entry.playerId)).size !== 4) {
      throw new Error(`Imported game ${index + 1} has a duplicate player.`)
    }
    const totalScore = game.entries.reduce((sum, entry) => sum + entry.score, 0)
    if (totalScore !== 0) {
      throw new Error(`Imported game ${index + 1} scores must sum to zero.`)
    }
  })

  const affectedPlayerIds = Array.from(new Set(normalizedGames.flatMap((game) => game.entries.map((entry) => entry.playerId))))
  const affectedSeasons = Array.from(new Set(normalizedGames.map((game) => game.seasonNumber)))
  const now = Timestamp.now()
  const configSnap = await getDoc(clubDoc(clubId, 'appConfig', 'settings'))
  const config = (configSnap.exists() ? configSnap.data() : {}) as AppConfigDoc & AppConfigLike
  const defaultStartingRating = config.eloStartingRating ?? 1500

  const makeDefaultStats = (playerId: string, seasonNumber?: number): PlayerStatsDoc => {
    const stats: PlayerStatsDoc = {
      playerId,
      totalPoints: 0,
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      winLossRatio: 0,
      bestSingleGame: Number.NEGATIVE_INFINITY,
      worstSingleGame: Number.POSITIVE_INFINITY,
      eloRating: defaultStartingRating,
      eloPeak: defaultStartingRating,
      eloRank: 0,
      pointsRank: 0,
      last5EloDelta: 0,
      recentEloDeltas: [],
      daysAttended: 0,
      lastPlayedAt: null,
      updatedAt: now
    }

    if (seasonNumber !== undefined) stats.seasonNumber = seasonNumber
    return stats
  }

  const allStatsSnapshot = await getDocs(query(clubCollection(clubId, 'playerStats')))
  const allStats = new Map<string, PlayerStatsDoc>()
  allStatsSnapshot.docs.forEach((docSnap) => {
    allStats.set(docSnap.id, docSnap.data() as PlayerStatsDoc)
  })

  const seasonStatsSnapshot = await getDocs(query(clubCollection(clubId, 'seasonPlayerStats')))
  const seasonStats = new Map<string, PlayerStatsDoc>()
  seasonStatsSnapshot.docs.forEach((docSnap) => {
    const stats = docSnap.data() as PlayerStatsDoc
    if (affectedSeasons.includes(stats.seasonNumber ?? 1)) {
      seasonStats.set(docSnap.id, stats)
    }
  })

  const gameWrites: Array<{ ref: DocumentReference; data: GameDoc }> = []
  const eloEventWrites: Array<{ ref: DocumentReference; data: EloEventDoc }> = []

  const updateStats = (statsMap: Map<string, PlayerStatsDoc>, statsKey: string, playerId: string, seasonNumber: number | undefined, score: number, gameDatetime: Timestamp, result: ReturnType<typeof calculateRoundEloDeltas>[number]) => {
    const current = statsMap.get(statsKey) ?? makeDefaultStats(playerId, seasonNumber)
    const isWin = score > 0
    const isLoss = score < 0
    const gameDate = gameDatetime.toDate().toISOString().slice(0, 10)
    const playedToday = current.lastPlayedAt === gameDate
    const recentEloDeltas = [...(current.recentEloDeltas ?? []), result.delta].slice(-5)
    const nextTotalPoints = current.totalPoints + score

    statsMap.set(statsKey, {
      ...current,
      totalPoints: nextTotalPoints,
      gamesPlayed: current.gamesPlayed + 1,
      gamesWon: current.gamesWon + (isWin ? 1 : 0),
      gamesLost: current.gamesLost + (isLoss ? 1 : 0),
      winLossRatio: (current.gamesWon + (isWin ? 1 : 0)) / Math.max(1, current.gamesLost + (isLoss ? 1 : 0)),
      bestSingleGame: Math.max(current.bestSingleGame, score),
      worstSingleGame: Math.min(current.worstSingleGame, score),
      eloRating: result.ratingAfter,
      eloPeak: Math.max(current.eloPeak, result.ratingAfter),
      last5EloDelta: recentEloDeltas.reduce((sum, delta) => sum + delta, 0),
      recentEloDeltas,
      daysAttended: current.daysAttended + (playedToday ? 0 : 1),
      lastPlayedAt: gameDate,
      updatedAt: now
    })
  }

  normalizedGames.forEach((game) => {
    const gameRef = doc(clubCollection(clubId, 'games'))
    const gameId = gameRef.id
    const winType = game.entries.every((entry) => entry.score === 0) ? 'draw' : 'self_draw'
    const winnerPlayerId = winType === 'draw'
      ? null
      : game.entries.reduce((winner, current) => current.score > winner.score ? current : winner).playerId

    const allTimeRoundEntries = game.entries.map((entry) => {
      const stats = allStats.get(entry.playerId) ?? makeDefaultStats(entry.playerId)
      return {
        playerId: entry.playerId,
        score: entry.score,
        ratingBefore: stats.eloRating,
        gamesPlayed: stats.gamesPlayed
      }
    })
    const seasonRoundEntries = game.entries.map((entry) => {
      const statsKey = `${game.seasonNumber}_${entry.playerId}`
      const stats = seasonStats.get(statsKey) ?? makeDefaultStats(entry.playerId, game.seasonNumber)
      return {
        playerId: entry.playerId,
        score: entry.score,
        ratingBefore: stats.eloRating,
        gamesPlayed: stats.gamesPlayed
      }
    })

    const allTimeResults = calculateRoundEloDeltas(allTimeRoundEntries, config)
    const seasonResults = calculateRoundEloDeltas(seasonRoundEntries, config)

    game.entries.forEach((entry) => {
      const allTimeResult = allTimeResults.find((result) => result.playerId === entry.playerId)!
      const seasonResult = seasonResults.find((result) => result.playerId === entry.playerId)!
      updateStats(allStats, entry.playerId, entry.playerId, undefined, entry.score, game.datetime, allTimeResult)
      updateStats(seasonStats, `${game.seasonNumber}_${entry.playerId}`, entry.playerId, game.seasonNumber, entry.score, game.datetime, seasonResult)
    })

    gameWrites.push({
      ref: gameRef,
      data: {
        id: gameId,
        datetime: game.datetime,
        createdBy: input.createdBy,
        seasonNumber: game.seasonNumber,
        tableId: null,
        entries: game.entries,
        winType,
        winnerPlayerId,
        loserPlayerId: null,
        fan: null,
        notes: game.notes ?? 'Imported from CSV'
      }
    })

    seasonResults.forEach((result) => {
      const eventRef = doc(clubCollection(clubId, 'eloEvents'))
      eloEventWrites.push({
        ref: eventRef,
        data: {
          id: eventRef.id,
          gameId,
          playerId: result.playerId,
          datetime: game.datetime,
          seasonNumber: game.seasonNumber,
          ratingBefore: result.ratingBefore,
          ratingAfter: result.ratingAfter,
          delta: result.delta,
          kFactor: result.kFactor,
          marginMultiplier: result.marginMultiplier,
          opponents: result.opponents
        }
      })
    })
  })

  const touchedAllStats = affectedPlayerIds.map((playerId) => allStats.get(playerId) ?? makeDefaultStats(playerId))
  const allRanks = computeGlobalRanks(touchedAllStats)
  touchedAllStats.forEach((stats) => {
    stats.eloRank = allRanks.eloRanks[stats.playerId] ?? 0
    stats.pointsRank = allRanks.pointsRanks[stats.playerId] ?? 0
  })

  const touchedSeasonStats = Array.from(seasonStats.entries())
    .filter(([key]) => affectedSeasons.some((seasonNumber) => key.startsWith(`${seasonNumber}_`)))
    .map(([key, stats]) => ({ key, stats }))

  affectedSeasons.forEach((seasonNumber) => {
    const seasonItems = touchedSeasonStats.filter((item) => item.stats.seasonNumber === seasonNumber).map((item) => item.stats)
    const ranks = computeGlobalRanks(seasonItems)
    seasonItems.forEach((stats) => {
      stats.eloRank = ranks.eloRanks[stats.playerId] ?? 0
      stats.pointsRank = ranks.pointsRanks[stats.playerId] ?? 0
    })
  })

  const playerTitleWrites = affectedPlayerIds.map((playerId) => {
    const latestSeason = Math.max(...normalizedGames.filter((game) => game.entries.some((entry) => entry.playerId === playerId)).map((game) => game.seasonNumber))
    const seasonStatsForPlayer = seasonStats.get(`${latestSeason}_${playerId}`)
    return {
      ref: clubDoc(clubId, 'players', playerId),
      title: assignTitle(seasonStatsForPlayer?.totalPoints ?? 0, config.titleBands ?? [])
    }
  })

  let batch = writeBatch(db)
  let writeCount = 0
  const commitIfNeeded = async (nextWrites = 1) => {
    if (writeCount + nextWrites <= 450) return
    await batch.commit()
    batch = writeBatch(db)
    writeCount = 0
  }
  const setInBatch = async (ref: DocumentReference, data: DocumentData, options?: { merge: true }) => {
    await commitIfNeeded()
    if (options) {
      batch.set(ref, data, options)
    } else {
      batch.set(ref, data)
    }
    writeCount += 1
  }

  for (const game of gameWrites) {
    await setInBatch(game.ref, game.data)
  }
  for (const event of eloEventWrites) {
    await setInBatch(event.ref, event.data)
  }
  for (const stats of touchedAllStats) {
    await setInBatch(clubDoc(clubId, 'playerStats', stats.playerId), stats)
  }
  for (const { key, stats } of touchedSeasonStats) {
    await setInBatch(clubDoc(clubId, 'seasonPlayerStats', key), stats)
  }
  for (const write of playerTitleWrites) {
    await setInBatch(write.ref, { title: write.title }, { merge: true })
  }

  if (writeCount > 0) {
    await batch.commit()
  }
}

export function subscribePlayers(clubId: string, callback: (players: PlayerDoc[]) => void) {
  const q = query(clubCollection(clubId, 'players'), where('active', '==', true))
  return onSnapshot(q, (snapshot) => {
    const players = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as PlayerDoc))
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
    callback(players)
  })
}

export function subscribeGames(clubId: string, callback: (games: GameDoc[]) => void, seasonNumber?: number) {
  const q = query(clubCollection(clubId, 'games'), orderBy('datetime'))
  return onSnapshot(q, (snapshot) => {
    const games = snapshot.docs.map((docSnap) => ({ id: docSnap.id, ...docSnap.data() } as GameDoc))
    callback(seasonNumber ? games.filter((game) => (game.seasonNumber ?? 1) === seasonNumber) : games)
  })
}

export function subscribePlayerStats(clubId: string, callback: (stats: Array<PlayerStatsDoc & { id: string }>) => void, seasonNumber?: number) {
  const q = seasonNumber
    ? query(clubCollection(clubId, 'seasonPlayerStats'), where('seasonNumber', '==', seasonNumber))
    : query(clubCollection(clubId, 'playerStats'), orderBy('eloRank'))
  return onSnapshot(q, async (snapshot) => {
    if (seasonNumber === 1 && snapshot.empty) {
      const fallback = await getDocs(query(clubCollection(clubId, 'playerStats'), orderBy('eloRank')))
      callback(fallback.docs.map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as PlayerStatsDoc), seasonNumber: 1 })))
      return
    }

    const stats = snapshot.docs
      .map((docSnap) => ({ id: docSnap.id, ...(docSnap.data() as PlayerStatsDoc) }))
      .sort((a, b) => (a.eloRank || Number.MAX_SAFE_INTEGER) - (b.eloRank || Number.MAX_SAFE_INTEGER))
    callback(stats)
  })
}

export function subscribeEloEvents(clubId: string, callback: (events: EloEventDoc[]) => void, seasonNumber?: number) {
  const q = query(clubCollection(clubId, 'eloEvents'), orderBy('datetime'))
  return onSnapshot(q, (snapshot) => {
    const events = snapshot.docs.map((docSnap) => {
      const data = docSnap.data() as EloEventDoc
      return { ...data, id: docSnap.id }
    })
    callback(seasonNumber ? events.filter((event) => (event.seasonNumber ?? 1) === seasonNumber) : events)
  })
}

export function subscribeLatestTableArrangement(clubId: string, callback: (arrangement: TableArrangementDoc | null) => void) {
  const q = query(clubCollection(clubId, 'tableArrangements'), orderBy('createdAt', 'desc'), limit(1))
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(null)
      return
    }
    const docSnap = snapshot.docs[0]
    const data = docSnap.data() as TableArrangementDoc
    callback({ ...data, id: docSnap.id })
  })
}

export async function saveTableArrangement(clubId: string, arrangement: TableArrangementDoc) {
  const ref = arrangement.id ? clubDoc(clubId, 'tableArrangements', arrangement.id) : doc(clubCollection(clubId, 'tableArrangements'))
  const { id, ...payload } = arrangement
  await setDoc(ref, { ...payload, id: ref.id, createdAt: arrangement.createdAt ?? Timestamp.now() })
  return ref.id
}

export function subscribeActiveSession(
  clubId: string,
  seasonNumber: number,
  callback: (session: SessionDoc | null) => void,
  onError?: (error: Error) => void
) {
  const q = query(clubCollection(clubId, 'sessions'), where('isActive', '==', true))
  return onSnapshot(q, (snapshot) => {
    if (snapshot.empty) {
      callback(null)
      return
    }

    const docSnap = snapshot.docs
      .filter((snap) => ((snap.data() as SessionDoc).seasonNumber ?? 1) === seasonNumber)
      .slice()
      .sort((a, b) => {
        const createdA = (a.data() as SessionDoc).createdAt?.toMillis?.() ?? 0
        const createdB = (b.data() as SessionDoc).createdAt?.toMillis?.() ?? 0
        return createdB - createdA
      })[0]
    if (!docSnap) {
      callback(null)
      return
    }
    const data = docSnap.data() as SessionDoc
    callback({ ...data, id: docSnap.id })
  }, onError)
}

export async function createSession(clubId: string, input: { createdBy: string; participants: string[]; tableCount: number; seasonNumber: number }) {
  const ref = doc(clubCollection(clubId, 'sessions'))
  const arrangement = assignSeats(input.participants, input.tableCount)
  const payload: SessionDoc = {
    id: ref.id,
    createdAt: Timestamp.now(),
    createdBy: input.createdBy,
    seasonNumber: input.seasonNumber,
    isActive: true,
    tableCount: input.tableCount,
    participants: input.participants,
    tables: arrangement.tables,
    sideline: arrangement.sideline,
    closedAt: null
  }

  await setDoc(ref, payload)
  return ref.id
}

export async function updateSession(clubId: string, sessionId: string, values: Partial<Omit<SessionDoc, 'id' | 'createdAt' | 'createdBy'>>) {
  await setDoc(clubDoc(clubId, 'sessions', sessionId), values, { merge: true })
}

export async function closeSession(clubId: string, sessionId: string) {
  await updateSession(clubId, sessionId, { isActive: false, closedAt: Timestamp.now() })
}

export async function getConfig(clubId: string) {
  const snap = await getDoc(clubDoc(clubId, 'appConfig', 'settings'))
  return (snap.exists() ? snap.data() : {}) as AppConfigDoc
}

export async function ensureConfig(clubId: string) {
  const ref = clubDoc(clubId, 'appConfig', 'settings')
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    await setDoc(ref, {
      titleBands: [
        { minPoints: 3000, maxPoints: 99999, title: 'Messiah' },
        { minPoints: 1800, maxPoints: 2999, title: 'Master' },
        { minPoints: 350, maxPoints: 1799, title: 'Musketeer' },
        { minPoints: 150, maxPoints: 349, title: 'Marshal' },
        { minPoints: -650, maxPoints: 149, title: 'Monk' },
        { minPoints: -700, maxPoints: -651, title: 'Mortal' },
        { minPoints: -1150, maxPoints: -701, title: 'Minion' },
        { minPoints: -1550, maxPoints: -1151, title: 'Mongrel' },
        { minPoints: -99999, maxPoints: -1551, title: 'Moron' }
      ],
      eloBaseK: 16,
      eloVeteranGamesThreshold: 50,
      eloStartingRating: 1500
    } as AppConfigDoc)
  }
}
