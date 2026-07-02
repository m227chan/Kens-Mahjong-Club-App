'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createGame, subscribePlayers } from '@/lib/firestore'
import type { PlayerDoc } from '@/lib/types'

export default function AddGamePage() {
  const router = useRouter()
  const { user, loading } = useAuth()
  const [players, setPlayers] = useState<PlayerDoc[]>([])
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [scores, setScores] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [loading, router, user])

  useEffect(() => subscribePlayers((nextPlayers) => setPlayers(nextPlayers)), [])

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds((current) => {
      if (current.includes(playerId)) {
        return current.filter((id) => id !== playerId)
      }
      setScores((prev) => ({ ...prev, [playerId]: 0 }))
      return [...current, playerId]
    })
  }

  const updateScore = (playerId: string, value: string) => {
    setScores((current) => ({ ...current, [playerId]: Number(value) || 0 }))
  }

  const total = useMemo(() => Object.values(scores).reduce((sum, value) => sum + value, 0), [scores])

  const handleSubmit = async () => {
    const entries = selectedPlayerIds.map((playerId) => ({ playerId, score: scores[playerId] ?? 0 }))

    if (entries.length !== 4) {
      setMessage('A Mahjong round requires exactly 4 players.')
      return
    }

    const total = entries.reduce((sum, entry) => sum + entry.score, 0)
    if (total !== 0) {
      setMessage('The four scores must sum to zero.')
      return
    }

    setSubmitting(true)
    setMessage(null)
    try {
      await createGame({
        entries,
        createdBy: user?.uid ?? 'anonymous',
        notes
      })
      setMessage('Game saved. ELO was updated for the players involved.')
      setSelectedPlayerIds([])
      setScores({})
      setNotes('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save the game.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-6 px-4 py-6">
      <header className="rounded-[24px] border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-500">Add game</p>
            <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Record a round</h1>
          </div>
          <Link href="/add-player" className="rounded-full border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100">
            + Add new player
          </Link>
        </div>
      </header>

      <section className="rounded-[24px] border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Select players</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => (
            <label key={player.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
              <input type="checkbox" checked={selectedPlayerIds.includes(player.id)} onChange={() => togglePlayer(player.id)} />
              <span>{player.displayName}</span>
            </label>
          ))}
        </div>
      </section>

      {selectedPlayerIds.length > 0 && (
        <section className="rounded-[24px] border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Scores</h2>
            <span className={`text-sm ${total === 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
              Sum: {total}
            </span>
          </div>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            {selectedPlayerIds.map((playerId) => {
              const player = players.find((entry) => entry.id === playerId)
              return (
                <label key={playerId} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
                  <div className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-200">{player?.displayName ?? playerId}</div>
                  <input
                    type="number"
                    value={scores[playerId] ?? 0}
                    onChange={(event) => updateScore(playerId, event.target.value)}
                    className="w-full rounded-xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none ring-0 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </label>
              )
            })}
          </div>
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            placeholder="Optional notes"
            className="mt-4 min-h-24 w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="mt-4 w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:opacity-60"
          >
            {submitting ? 'Saving…' : 'Save game'}
          </button>
          {message && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{message}</p>}
        </section>
      )}
    </main>
  )
}
