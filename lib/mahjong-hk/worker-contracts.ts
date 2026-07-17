import type { Recommendation, RecommendationOptions } from '@/lib/mahjong-hk/recommendation'
import type { ObservedGameState } from '@/lib/mahjong-hk/state'

export type SearchWorkerRequest = {
  v: 1
  type: 'RECOMMEND_DISCARD'
  requestId: number
  state: ObservedGameState
  options: Omit<RecommendationOptions, 'shouldCancel'>
}

export type SearchWorkerResponse =
  | { v: 1; type: 'RESULT'; requestId: number; recommendation: Recommendation }
  | { v: 1; type: 'ERROR'; requestId: number; message: string }

