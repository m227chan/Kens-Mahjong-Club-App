/// <reference lib="webworker" />

import { recommendDiscard } from '@/lib/mahjong-hk/recommendation'
import { HK_CLASSICAL_V1 } from '@/lib/mahjong-hk/rules/hk-classical-v1'
import type { SearchWorkerRequest, SearchWorkerResponse } from '@/lib/mahjong-hk/worker-contracts'

const scope = self as DedicatedWorkerGlobalScope

scope.addEventListener('message', (event: MessageEvent<SearchWorkerRequest>) => {
  const request = event.data
  if (request.v !== 1 || request.type !== 'RECOMMEND_DISCARD') return
  try {
    const recommendation = recommendDiscard(request.state, HK_CLASSICAL_V1, request.options)
    const response: SearchWorkerResponse = { v: 1, type: 'RESULT', requestId: request.requestId, recommendation }
    scope.postMessage(response)
  } catch (error) {
    const response: SearchWorkerResponse = {
      v: 1,
      type: 'ERROR',
      requestId: request.requestId,
      message: error instanceof Error ? error.message : 'Recommendation failed.',
    }
    scope.postMessage(response)
  }
})

export {}

