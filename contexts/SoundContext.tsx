'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { getSoundPreference, setSoundPreference } from '@/lib/supabase-data'

export type SoundCue = 'win' | 'loss' | 'draw' | 'achievement' | 'tile' | 'confirmation' | 'rank-up' | 'rank-down' | 'error'

type SoundContextValue = {
  enabled: boolean
  toggle: () => void
  unlock: () => void
  play: (cue: SoundCue) => void
}

const SoundContext = createContext<SoundContextValue | null>(null)
const LOCAL_KEY = 'mahjong:sound-enabled'

function tone(context: AudioContext, destination: AudioNode, frequency: number, start: number, duration: number, volume: number, type: OscillatorType = 'sine') {
  const oscillator = context.createOscillator()
  const gain = context.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, start)
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.012)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain).connect(destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

function clack(context: AudioContext, destination: AudioNode, start: number, volume: number) {
  const length = Math.floor(context.sampleRate * 0.055)
  const buffer = context.createBuffer(1, length, context.sampleRate)
  const channel = buffer.getChannelData(0)
  for (let index = 0; index < length; index += 1) channel[index] = (Math.random() * 2 - 1) * Math.pow(1 - index / length, 5)
  const source = context.createBufferSource()
  const filter = context.createBiquadFilter()
  const gain = context.createGain()
  filter.type = 'bandpass'
  filter.frequency.value = 1750
  filter.Q.value = 1.8
  gain.gain.value = volume
  source.buffer = buffer
  source.connect(filter).connect(gain).connect(destination)
  source.start(start)
}

export function SoundProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const [enabled, setEnabled] = useState(true)
  const contextRef = useRef<AudioContext | null>(null)
  const resumeRef = useRef<Promise<void> | null>(null)

  const ensureAudioReady = useCallback(async () => {
    let context = contextRef.current
    if (!context || context.state === 'closed') {
      context = new AudioContext({ latencyHint: 'interactive' })
      contextRef.current = context
    }

    if (context.state !== 'running') {
      if (!resumeRef.current) {
        resumeRef.current = context.resume().then(() => undefined).finally(() => {
          resumeRef.current = null
        })
      }
      try {
        await resumeRef.current
      } catch {
        return null
      }
    }

    return context.state === 'running' ? context : null
  }, [])

  const unlock = useCallback(() => {
    void ensureAudioReady()
  }, [ensureAudioReady])

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LOCAL_KEY)
      if (stored !== null) setEnabled(stored === 'true')
    } catch { /* Storage may be unavailable in privacy mode. */ }
  }, [])

  useEffect(() => {
    if (!user) return
    let active = true
    const load = getSoundPreference(user.uid)
    void load.then((preference) => {
      if (active && typeof preference === 'boolean') {
        setEnabled(preference)
        try { window.localStorage.setItem(LOCAL_KEY, String(preference)) } catch { /* best effort */ }
      }
    }).catch(() => undefined)
    return () => { active = false }
  }, [user])

  useEffect(() => {
    const prepare = () => unlock()
    window.addEventListener('pointerdown', prepare, { passive: true })
    window.addEventListener('keydown', prepare)
    return () => {
      window.removeEventListener('pointerdown', prepare)
      window.removeEventListener('keydown', prepare)
    }
  }, [unlock])

  const play = useCallback((cue: SoundCue) => {
    if (!enabled) return
    void ensureAudioReady().then((context) => {
      if (!context) return
      const now = context.currentTime + 0.005
      const output = context.createGain()
      output.gain.value = 0.85
      output.connect(context.destination)

      if (cue === 'tile') clack(context, output, now, 0.18)
      else if (cue === 'win') { clack(context, output, now, 0.12); tone(context, output, 523, now + 0.04, 0.22, 0.10); tone(context, output, 659, now + 0.13, 0.28, 0.09); tone(context, output, 784, now + 0.23, 0.38, 0.08) }
      else if (cue === 'draw') { clack(context, output, now, 0.11); tone(context, output, 392, now + 0.035, 0.18, 0.055) }
      else if (cue === 'achievement') { tone(context, output, 440, now, 0.2, 0.06); tone(context, output, 554, now + 0.1, 0.24, 0.065); tone(context, output, 659, now + 0.21, 0.32, 0.06) }
      else if (cue === 'rank-up') { tone(context, output, 440, now, 0.18, 0.055); tone(context, output, 587, now + 0.1, 0.24, 0.06) }
      else if (cue === 'rank-down' || cue === 'loss') { tone(context, output, 392, now, 0.18, 0.045, 'triangle'); tone(context, output, 330, now + 0.1, 0.22, 0.04, 'triangle') }
      else if (cue === 'error') { tone(context, output, 220, now, 0.14, 0.045, 'triangle'); tone(context, output, 196, now + 0.08, 0.16, 0.035, 'triangle') }
      else { tone(context, output, 494, now, 0.17, 0.05); tone(context, output, 622, now + 0.09, 0.22, 0.045) }

      window.setTimeout(() => output.disconnect(), 1200)
    })
  }, [enabled, ensureAudioReady])

  const toggle = useCallback(() => {
    unlock()
    setEnabled((current) => {
      const next = !current
      try { window.localStorage.setItem(LOCAL_KEY, String(next)) } catch { /* best effort */ }
      if (user) {
        const save = setSoundPreference(user.uid, next)
        void save.catch(() => undefined)
      }
      return next
    })
  }, [unlock, user])

  return <SoundContext.Provider value={{ enabled, toggle, unlock, play }}>{children}</SoundContext.Provider>
}

export function useSound() {
  const value = useContext(SoundContext)
  if (!value) throw new Error('useSound must be used inside SoundProvider.')
  return value
}
