'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createGame } from '@/lib/data'
import {
  enqueueGame,
  listQueuedGames,
  markQueuedGamesForRetry,
  queuedGameSyncInput,
  removeQueuedGame,
  subscribeQueuedGames,
  updateQueuedGame,
  type OfflineGameInput,
  type QueuedGame,
} from '@/lib/offline-game-queue'

type SaveGameResult = { status: 'synced' | 'queued' | 'attention' }

type GameSyncValue = {
  saveGame: (clubId: string, input: OfflineGameInput) => Promise<SaveGameResult>
  retryNow: () => void
  online: boolean
  pendingCount: number
  attentionCount: number
  syncing: boolean
}

const GameSyncContext = createContext<GameSyncValue | null>(null)
const SAVE_DEADLINE_MS = 8_000
const BACKGROUND_DEADLINE_MS = 20_000

class GameSyncTimeoutError extends Error {
  readonly retryable = true

  constructor() {
    super('The connection timed out.')
    this.name = 'GameSyncTimeoutError'
  }
}

const isOnline = () => typeof navigator === 'undefined' || navigator.onLine

const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : 'Unable to sync this saved game.'

export const isRetryableGameSyncError = (error: unknown) => {
  if (!isOnline()) return true
  if (error instanceof TypeError) return true
  if ((error as { retryable?: unknown } | null)?.retryable === true) return true
  return /failed to fetch|network(?:error)?|load failed|timed out|temporarily unavailable/i.test(
    errorMessage(error),
  )
}

const withinDeadline = async <T,>(promise: Promise<T>, timeoutMs: number) => {
  let timeout: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new GameSyncTimeoutError()), timeoutMs)
      }),
    ])
  } finally {
    if (timeout) clearTimeout(timeout)
  }
}

export function GameSyncProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [online, setOnline] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [attentionCount, setAttentionCount] = useState(0)
  const [syncing, setSyncing] = useState(false)
  const [lastSyncedCount, setLastSyncedCount] = useState(0)
  const [lastError, setLastError] = useState<string | null>(null)
  const syncingRef = useRef(false)

  const refreshCounts = useCallback(() => {
    const items = user ? listQueuedGames(user.uid) : []
    setPendingCount(items.filter((item) => item.status === 'pending').length)
    setAttentionCount(items.filter((item) => item.status === 'attention').length)
  }, [user])

  const recordFailure = useCallback((item: QueuedGame, error: unknown) => {
    const retryable = isRetryableGameSyncError(error)
    updateQueuedGame(item.id, {
      attempts: item.attempts + 1,
      status: retryable ? 'pending' : 'attention',
      lastError: errorMessage(error),
    })
    if (!retryable) setLastError(errorMessage(error))
    return retryable
  }, [])

  const syncQueuedGames = useCallback(async () => {
    if (!user || !isOnline() || syncingRef.current) return
    const items = listQueuedGames(user.uid).filter((item) => item.status === 'pending')
    if (!items.length) {
      refreshCounts()
      return
    }

    syncingRef.current = true
    setSyncing(true)
    let synced = 0
    try {
      for (const item of items) {
        try {
          await withinDeadline(
            createGame(item.clubId, queuedGameSyncInput(item)),
            BACKGROUND_DEADLINE_MS,
          )
          removeQueuedGame(item.id)
          synced += 1
        } catch (error) {
          const retryable = recordFailure(item, error)
          if (retryable) break
        }
      }
    } finally {
      syncingRef.current = false
      setSyncing(false)
      refreshCounts()
      if (synced > 0) setLastSyncedCount(synced)
    }
  }, [recordFailure, refreshCounts, user])

  const saveGame = useCallback(
    async (clubId: string, input: OfflineGameInput): Promise<SaveGameResult> => {
      if (!user || user.uid !== input.createdBy)
        throw new Error('Sign in again before recording this game.')

      let item: QueuedGame
      try {
        item = enqueueGame(user.uid, clubId, input)
        refreshCounts()
      } catch (storageError) {
        if (isOnline()) {
          try {
            await withinDeadline(createGame(clubId, input), SAVE_DEADLINE_MS)
            return { status: 'synced' }
          } catch (networkError) {
            throw new Error(
              `${errorMessage(networkError)} This browser also blocked the offline backup: ${errorMessage(storageError)}`,
            )
          }
        }
        throw storageError
      }

      if (!isOnline()) {
        setOnline(false)
        return { status: 'queued' }
      }

      try {
        await withinDeadline(createGame(clubId, input), SAVE_DEADLINE_MS)
        removeQueuedGame(item.id)
        refreshCounts()
        return { status: 'synced' }
      } catch (error) {
        const retryable = recordFailure(item, error)
        refreshCounts()
        return { status: retryable ? 'queued' : 'attention' }
      }
    },
    [recordFailure, refreshCounts, user],
  )

  const retryNow = useCallback(() => {
    if (!user) return
    markQueuedGamesForRetry(user.uid)
    setLastError(null)
    refreshCounts()
    void syncQueuedGames()
  }, [refreshCounts, syncQueuedGames, user])

  useEffect(() => {
    const updateConnection = () => {
      const next = isOnline()
      setOnline(next)
      if (next) void syncQueuedGames()
    }
    updateConnection()
    window.addEventListener('online', updateConnection)
    window.addEventListener('offline', updateConnection)
    return () => {
      window.removeEventListener('online', updateConnection)
      window.removeEventListener('offline', updateConnection)
    }
  }, [syncQueuedGames])

  useEffect(() => {
    refreshCounts()
    const unsubscribe = subscribeQueuedGames(refreshCounts)
    return unsubscribe
  }, [refreshCounts])

  useEffect(() => {
    if (user && online) void syncQueuedGames()
  }, [online, syncQueuedGames, user])

  useEffect(() => {
    if (!user || !online || pendingCount === 0) return
    const timer = window.setInterval(() => void syncQueuedGames(), 15_000)
    const onVisible = () => {
      if (document.visibilityState === 'visible') void syncQueuedGames()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [online, pendingCount, syncQueuedGames, user])

  useEffect(() => {
    if (!lastSyncedCount) return
    const timer = window.setTimeout(() => setLastSyncedCount(0), 4_000)
    return () => window.clearTimeout(timer)
  }, [lastSyncedCount])

  const showBanner = !online || pendingCount > 0 || attentionCount > 0 || lastSyncedCount > 0
  const tone = attentionCount > 0 ? 'attention' : !online ? 'offline' : pendingCount > 0 ? 'pending' : 'synced'
  const message = attentionCount > 0
    ? `${online ? '' : 'Offline · '}${attentionCount} saved game${attentionCount === 1 ? '' : 's'} need${attentionCount === 1 ? 's' : ''} attention and remain${attentionCount === 1 ? 's' : ''} on this device.`
    : !online
      ? pendingCount > 0
        ? `Offline · ${pendingCount} game${pendingCount === 1 ? '' : 's'} safely stored here. Standings aren’t live.`
        : 'You’re offline. Standings aren’t live; new games will be saved on this device.'
      : pendingCount > 0
        ? syncing
          ? `Syncing ${pendingCount} saved game${pendingCount === 1 ? '' : 's'}…`
          : `${pendingCount} saved game${pendingCount === 1 ? '' : 's'} waiting to sync. Live updates may be delayed.`
        : `${lastSyncedCount} saved game${lastSyncedCount === 1 ? '' : 's'} synced.`

  return (
    <GameSyncContext.Provider
      value={{ saveGame, retryNow, online, pendingCount, attentionCount, syncing }}
    >
      {children}
      {showBanner ? (
        <aside
          className={`game-sync-banner game-sync-banner-${tone}`}
          role="status"
          aria-live="polite"
          title={lastError ?? undefined}
        >
          <span className="game-sync-pulse" aria-hidden="true" />
          <span>{message}</span>
          {online && (pendingCount > 0 || attentionCount > 0) ? (
            <button type="button" onClick={retryNow} disabled={syncing}>
              {syncing ? 'Syncing…' : 'Retry'}
            </button>
          ) : null}
        </aside>
      ) : null}
    </GameSyncContext.Provider>
  )
}

export function useGameSync() {
  const value = useContext(GameSyncContext)
  if (!value) throw new Error('useGameSync must be used inside GameSyncProvider.')
  return value
}
