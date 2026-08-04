'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react'
import { useAuth } from '@/contexts/AuthContext'
import type { SessionPointWindowHours } from '@/lib/data'

const STORAGE_KEY = 'mahjong:floating-session-tracker:v1'

export type FloatingSessionTrackerConfig = {
  clubId: string
  clubName: string
  playerId: string
  playerName: string
  playerIcon: string
  hours: SessionPointWindowHours
}

export type FloatingSessionTrackerState = FloatingSessionTrackerConfig & {
  enabled: boolean
}

type FloatingSessionTrackerValue = {
  state: FloatingSessionTrackerState | null
  enableFloat: (config: FloatingSessionTrackerConfig) => void
  disableFloat: () => void
  setFloatHours: (hours: SessionPointWindowHours) => void
  isFloatingFor: (clubId: string, playerId?: string, hours?: SessionPointWindowHours) => boolean
}

const FloatingSessionTrackerContext =
  createContext<FloatingSessionTrackerValue | null>(null)

function readStoredState(): FloatingSessionTrackerState | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as FloatingSessionTrackerState
    if (
      !value?.enabled ||
      !value.clubId ||
      !value.playerId ||
      !value.playerName ||
      ![24, 48, 168].includes(Number(value.hours))
    ) {
      return null
    }
    return {
      enabled: true,
      clubId: String(value.clubId).trim().toUpperCase(),
      clubName: String(value.clubName ?? ''),
      playerId: String(value.playerId),
      playerName: String(value.playerName),
      playerIcon: String(value.playerIcon ?? '🀄'),
      hours: Number(value.hours) as SessionPointWindowHours,
    }
  } catch {
    return null
  }
}

function writeStoredState(state: FloatingSessionTrackerState | null) {
  try {
    if (!state?.enabled) {
      window.localStorage.removeItem(STORAGE_KEY)
      return
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* private storage mode */
  }
}

export function FloatingSessionTrackerProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const { user, loading } = useAuth()
  const [state, setState] = useState<FloatingSessionTrackerState | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    setState(readStoredState())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (!hydrated || loading) return
    if (!user && state?.enabled) {
      setState(null)
      writeStoredState(null)
    }
  }, [hydrated, loading, state?.enabled, user])

  const enableFloat = useCallback((config: FloatingSessionTrackerConfig) => {
    const next: FloatingSessionTrackerState = {
      enabled: true,
      clubId: config.clubId.trim().toUpperCase(),
      clubName: config.clubName,
      playerId: config.playerId,
      playerName: config.playerName,
      playerIcon: config.playerIcon || '🀄',
      hours: config.hours,
    }
    setState(next)
    writeStoredState(next)
  }, [])

  const disableFloat = useCallback(() => {
    setState(null)
    writeStoredState(null)
  }, [])

  const setFloatHours = useCallback((hours: SessionPointWindowHours) => {
    setState((current) => {
      if (!current?.enabled) return current
      const next = { ...current, hours }
      writeStoredState(next)
      return next
    })
  }, [])

  const isFloatingFor = useCallback(
    (clubId: string, playerId?: string, hours?: SessionPointWindowHours) => {
      if (!state?.enabled) return false
      if (state.clubId !== clubId.trim().toUpperCase()) return false
      if (playerId != null && state.playerId !== playerId) return false
      if (hours != null && state.hours !== hours) return false
      return true
    },
    [state],
  )

  const value = useMemo<FloatingSessionTrackerValue>(
    () => ({ state, enableFloat, disableFloat, setFloatHours, isFloatingFor }),
    [disableFloat, enableFloat, isFloatingFor, setFloatHours, state],
  )

  return (
    <FloatingSessionTrackerContext.Provider value={value}>
      {children}
    </FloatingSessionTrackerContext.Provider>
  )
}

export function useFloatingSessionTracker() {
  const context = useContext(FloatingSessionTrackerContext)
  if (!context) {
    throw new Error(
      'useFloatingSessionTracker must be used within FloatingSessionTrackerProvider',
    )
  }
  return context
}
