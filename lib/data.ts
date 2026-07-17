'use client'

import * as supabase from '@/lib/supabase-data'
import { auth } from '@/lib/firebase'

const backend = supabase

export const createClub = backend.createClub
export const getCreatedClubCount = backend.getCreatedClubCount
export const subscribeClub = backend.subscribeClub
export const subscribeUserClubs = backend.subscribeUserClubs
export const promoteManagerByEmail = backend.promoteManagerByEmail
export const subscribeClubMembers = backend.subscribeClubMembers
export const requestToJoinClub = backend.requestToJoinClub
export const subscribeJoinRequests = backend.subscribeJoinRequests
export const resolveJoinRequest = backend.resolveJoinRequest
export const leaveClub = backend.leaveClub
export const createPlayer = backend.createPlayer
export const removePlayer = backend.removePlayer
export const setPlayerAuthLink = backend.setPlayerAuthLink
export const updatePlayerIcon = backend.updatePlayerIcon
export const updatePlayerName = backend.updatePlayerName
export const deleteClub = backend.deleteClub
export const createGame = backend.createGame
export const subscribeSeasons = backend.subscribeSeasons
export const ensureSeasons = backend.ensureSeasons
export const startNewSeason = backend.startNewSeason
export const setActiveSeason = backend.setActiveSeason
export const importGames = backend.importGames
export const subscribePlayers = backend.subscribePlayers
export const invalidateClubHistoryCache = backend.invalidateClubHistoryCache
export const loadGamesPage = backend.loadGamesPage
export const loadAllGames = backend.loadAllGames
export const loadAnalyticsGames = backend.loadAnalyticsGames
export const loadAnalyticsSkillEvents = backend.loadAnalyticsSkillEvents
export const getClubGameCount = backend.getClubGameCount
export const subscribePlayerStats = backend.subscribePlayerStats
export const subscribeActiveSession = backend.subscribeActiveSession
export const createSession = backend.createSession
export const updateSession = backend.updateSession
export const closeSession = backend.closeSession
export const ensureConfig = backend.ensureConfig
export const claimMingWelcome = backend.claimMingWelcome

async function postGameMutation(body: Record<string, unknown>) {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sign in again before modifying a game.')
  const response = await fetch('/api/supabase-data', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ action: 'mutateGame', mutation: body }),
  })
  const result = (await response.json()) as { error?: string }
  if (!response.ok) throw new Error(result.error ?? 'Unable to modify game.')
}

export const mutateGameRecord = (body: {
  clubId: string
  gameId: string
  action: 'update' | 'delete'
  game?: unknown
}) => postGameMutation(body)
export const rebuildClubStats = (clubId: string) =>
  postGameMutation({ clubId, action: 'rebuild' })
