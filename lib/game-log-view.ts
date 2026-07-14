import type { GameDoc } from '@/lib/types'

export type GameLogAudience = 'all' | 'session' | 'player'
export type GameLogLayout = 'cards' | 'table'

export const DEFAULT_GAME_LOG_AUDIENCE: GameLogAudience = 'session'
export const DEFAULT_GAME_LOG_LAYOUT: GameLogLayout = 'cards'

export function filterGamesByAudience(
  games: GameDoc[],
  audience: GameLogAudience,
  sessionPlayerIds: string[],
  selectedPlayerId: string
) {
  if (audience === 'session') {
    const sessionIds = new Set(sessionPlayerIds)
    return games.filter((game) => game.entries.some((entry) => sessionIds.has(entry.playerId)))
  }
  if (audience === 'player' && selectedPlayerId) {
    return games.filter((game) => game.entries.some((entry) => entry.playerId === selectedPlayerId))
  }
  return games
}
