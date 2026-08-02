export const OFFLINE_GAME_QUEUE_KEY = 'mahjong:offline-game-queue:v1'
export const OFFLINE_GAME_QUEUE_EVENT = 'mahjong:offline-game-queue-changed'
const MAX_QUEUED_GAMES_PER_USER = 100

export type OfflineGameInput = {
  entries: Array<{ playerId: string; score: number }>
  createdBy: string
  seasonNumber: number
  tableId: string | null
  winType: 'self_draw' | 'discard' | 'draw'
  loserPlayerId: string | null
  fan: number | null
  notes: string | null
  idempotencyKey: string
}

export type QueuedGameStatus = 'pending' | 'attention'

export type QueuedGame = {
  id: string
  ownerUid: string
  clubId: string
  input: OfflineGameInput
  recordedAt: string
  queuedAt: string
  attempts: number
  status: QueuedGameStatus
  lastError: string | null
}

const storage = () => {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

const isQueuedGame = (value: unknown): value is QueuedGame => {
  if (!value || typeof value !== 'object') return false
  const item = value as Partial<QueuedGame>
  return Boolean(
    typeof item.id === 'string' &&
      typeof item.ownerUid === 'string' &&
      typeof item.clubId === 'string' &&
      typeof item.recordedAt === 'string' &&
      typeof item.queuedAt === 'string' &&
      item.input &&
      typeof item.input === 'object' &&
      typeof item.input.idempotencyKey === 'string' &&
      Array.isArray(item.input.entries),
  )
}

const readAll = (): QueuedGame[] => {
  const target = storage()
  if (!target) return []
  try {
    const parsed: unknown = JSON.parse(target.getItem(OFFLINE_GAME_QUEUE_KEY) ?? '[]')
    return Array.isArray(parsed) ? parsed.filter(isQueuedGame) : []
  } catch {
    return []
  }
}

const notify = () => {
  if (typeof window !== 'undefined')
    window.dispatchEvent(new Event(OFFLINE_GAME_QUEUE_EVENT))
}

const writeAll = (items: QueuedGame[]) => {
  const target = storage()
  if (!target)
    throw new Error('Offline storage is unavailable in this browser.')
  target.setItem(OFFLINE_GAME_QUEUE_KEY, JSON.stringify(items))
  notify()
}

export const listQueuedGames = (ownerUid?: string) =>
  readAll()
    .filter((item) => !ownerUid || item.ownerUid === ownerUid)
    .sort((a, b) => a.queuedAt.localeCompare(b.queuedAt))

export function enqueueGame(
  ownerUid: string,
  clubId: string,
  input: OfflineGameInput,
  recordedAt = new Date().toISOString(),
) {
  const items = readAll()
  const existing = items.find(
    (item) =>
      item.ownerUid === ownerUid &&
      item.clubId === clubId &&
      item.input.idempotencyKey === input.idempotencyKey,
  )
  if (existing) return existing
  if (items.filter((item) => item.ownerUid === ownerUid).length >= MAX_QUEUED_GAMES_PER_USER)
    throw new Error('This device already has 100 unsynced games. Reconnect before recording more.')

  const item: QueuedGame = {
    id: `${ownerUid}:${clubId}:${input.idempotencyKey}`,
    ownerUid,
    clubId,
    input,
    recordedAt,
    queuedAt: new Date().toISOString(),
    attempts: 0,
    status: 'pending',
    lastError: null,
  }
  writeAll([...items, item])
  return item
}

export function removeQueuedGame(id: string) {
  const items = readAll()
  if (!items.some((item) => item.id === id)) return
  writeAll(items.filter((item) => item.id !== id))
}

export function updateQueuedGame(
  id: string,
  patch: Partial<Pick<QueuedGame, 'attempts' | 'status' | 'lastError'>>,
) {
  const items = readAll()
  let changed = false
  const next = items.map((item) => {
    if (item.id !== id) return item
    changed = true
    return { ...item, ...patch }
  })
  if (changed) writeAll(next)
}

export function markQueuedGamesForRetry(ownerUid: string) {
  const items = readAll()
  let changed = false
  const next = items.map((item) => {
    if (item.ownerUid !== ownerUid || item.status !== 'attention') return item
    changed = true
    return { ...item, status: 'pending' as const }
  })
  if (changed) writeAll(next)
}

export function subscribeQueuedGames(listener: () => void) {
  if (typeof window === 'undefined') return () => undefined
  const onStorage = (event: StorageEvent) => {
    if (!event.key || event.key === OFFLINE_GAME_QUEUE_KEY) listener()
  }
  window.addEventListener(OFFLINE_GAME_QUEUE_EVENT, listener)
  window.addEventListener('storage', onStorage)
  return () => {
    window.removeEventListener(OFFLINE_GAME_QUEUE_EVENT, listener)
    window.removeEventListener('storage', onStorage)
  }
}

export const queuedGameSyncInput = (item: QueuedGame) => ({
  ...item.input,
  datetime: item.recordedAt,
})
