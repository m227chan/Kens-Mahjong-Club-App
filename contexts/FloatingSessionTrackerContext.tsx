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
import {
  hoursSessionWindow,
  isSessionPointWindowHours,
  normalizeSessionPointWindow,
  sessionWindowsEqual,
  type SessionPointWindow,
  type SessionPointWindowHours,
} from '@/lib/session-point-window'

const STORAGE_KEY = 'mahjong:floating-session-tracker:v2'

export type FloatingSessionTrackerConfig = {
  clubId: string
  clubName: string
  playerId: string
  playerName: string
  playerIcon: string
  window: SessionPointWindow
}

export type FloatingSessionTrackerState = FloatingSessionTrackerConfig & {
  enabled: boolean
}

type FloatingSessionTrackerValue = {
  state: FloatingSessionTrackerState | null
  enableFloat: (config: FloatingSessionTrackerConfig) => void
  disableFloat: () => void
  setFloatWindow: (window: SessionPointWindow) => void
  setFloatHours: (hours: SessionPointWindowHours) => void
  isFloatingFor: (
    clubId: string,
    playerId?: string,
    window?: SessionPointWindow | SessionPointWindowHours,
  ) => boolean
}

const FloatingSessionTrackerContext =
  createContext<FloatingSessionTrackerValue | null>(null)

function readStoredState(): FloatingSessionTrackerState | null {
  try {
    const raw =
      window.localStorage.getItem(STORAGE_KEY) ??
      window.localStorage.getItem('mahjong:floating-session-tracker:v1')
    if (!raw) return null
    const value = JSON.parse(raw) as FloatingSessionTrackerState & {
      hours?: SessionPointWindowHours
      window?: SessionPointWindow
    }
    if (!value?.enabled || !value.clubId || !value.playerId || !value.playerName) {
      return null
    }
    const nextWindow = value.window
      ? normalizeSessionPointWindow(value.window)
      : isSessionPointWindowHours(value.hours)
        ? hoursSessionWindow(value.hours)
        : null
    if (!nextWindow) return null
    return {
      enabled: true,
      clubId: String(value.clubId).trim().toUpperCase(),
      clubName: String(value.clubName ?? ''),
      playerId: String(value.playerId),
      playerName: String(value.playerName),
      playerIcon: String(value.playerIcon ?? '🀄'),
      window: nextWindow,
    }
  } catch {
    return null
  }
}

function writeStoredState(state: FloatingSessionTrackerState | null) {
  try {
    window.localStorage.removeItem('mahjong:floating-session-tracker:v1')
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
      window: config.window,
    }
    setState(next)
    writeStoredState(next)
  }, [])

  const disableFloat = useCallback(() => {
    setState(null)
    writeStoredState(null)
  }, [])

  const setFloatWindow = useCallback((nextWindow: SessionPointWindow) => {
    setState((current) => {
      if (!current?.enabled) return current
      const next = { ...current, window: nextWindow }
      writeStoredState(next)
      return next
    })
  }, [])

  const setFloatHours = useCallback((hours: SessionPointWindowHours) => {
    setFloatWindow(hoursSessionWindow(hours))
  }, [setFloatWindow])

  const isFloatingFor = useCallback(
    (
      clubId: string,
      playerId?: string,
      windowOrHours?: SessionPointWindow | SessionPointWindowHours,
    ) => {
      if (!state?.enabled) return false
      if (state.clubId !== clubId.trim().toUpperCase()) return false
      if (playerId != null && state.playerId !== playerId) return false
      if (windowOrHours != null) {
        const expected =
          typeof windowOrHours === 'number'
            ? hoursSessionWindow(windowOrHours)
            : windowOrHours
        if (!sessionWindowsEqual(state.window, expected)) return false
      }
      return true
    },
    [state],
  )

  const value = useMemo<FloatingSessionTrackerValue>(
    () => ({
      state,
      enableFloat,
      disableFloat,
      setFloatWindow,
      setFloatHours,
      isFloatingFor,
    }),
    [
      disableFloat,
      enableFloat,
      isFloatingFor,
      setFloatHours,
      setFloatWindow,
      state,
    ],
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
