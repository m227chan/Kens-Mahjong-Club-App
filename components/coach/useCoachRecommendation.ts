'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import type { Recommendation, RecommendationOptions } from '@/lib/mahjong-hk/recommendation'
import type { ObservedGameState } from '@/lib/mahjong-hk/state'
import type { SearchWorkerRequest, SearchWorkerResponse } from '@/lib/mahjong-hk/worker-contracts'

export function useCoachRecommendation() {
  const workerRef = useRef<Worker | null>(null)
  const requestRef = useRef(0)
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null)
  const [calculating, setCalculating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const worker = new Worker(new URL('../../workers/coach-search.worker.ts', import.meta.url), { type: 'module' })
    workerRef.current = worker
    worker.onmessage = (event: MessageEvent<SearchWorkerResponse>) => {
      const response = event.data
      if (response.requestId !== requestRef.current) return
      setCalculating(false)
      if (response.type === 'RESULT') {
        setRecommendation(response.recommendation)
        setError(null)
      } else {
        setRecommendation(null)
        setError(response.message)
      }
    }
    worker.onerror = () => {
      setCalculating(false)
      setRecommendation(null)
      setError('The strategy worker could not start on this device.')
    }
    return () => {
      worker.terminate()
      workerRef.current = null
    }
  }, [])

  const evaluate = useCallback((state: ObservedGameState, options: Omit<RecommendationOptions, 'shouldCancel'> = {}) => {
    const worker = workerRef.current
    if (!worker) return
    const requestId = requestRef.current + 1
    requestRef.current = requestId
    setCalculating(true)
    setError(null)
    const request: SearchWorkerRequest = { v: 1, type: 'RECOMMEND_DISCARD', requestId, state, options }
    worker.postMessage(request)
  }, [])

  const clear = useCallback(() => {
    requestRef.current += 1
    setRecommendation(null)
    setCalculating(false)
    setError(null)
  }, [])

  return { recommendation, calculating, error, evaluate, clear }
}

