'use client'

import { useEffect, useMemo, useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import { assignSeats } from '@/lib/stats-engine'
import { saveTableArrangement, subscribePlayers } from '@/lib/firestore'
import type { PlayerDoc } from '@/lib/types'

export default function TablesPage() {
  const [players, setPlayers] = useState<PlayerDoc[]>([])
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [numberOfTables, setNumberOfTables] = useState(2)
  const [arrangement, setArrangement] = useState<{ tables: Record<string, string[]>; sideline: string[] } | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => subscribePlayers((nextPlayers) => setPlayers(nextPlayers)), [])

  const togglePlayer = (playerId: string) => {
    setSelectedPlayerIds((current) => current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId])
  }

  const generateArrangement = () => {
    const next = assignSeats(selectedPlayerIds, numberOfTables)
    setArrangement(next)
  }

  const saveArrangement = async () => {
    if (!arrangement) return
    await saveTableArrangement({
      id: '',
      createdAt: Timestamp.now(),
      tables: arrangement.tables,
      sideline: arrangement.sideline
    })
    setMessage('Arrangement saved.')
  }

  const selectedPlayers = useMemo(() => players.filter((player) => selectedPlayerIds.includes(player.id)), [players, selectedPlayerIds])

  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 px-4 py-6">
      <header className="rounded-[24px] border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-500">Tables</p>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Seat the club</h1>
      </header>

      <section className="rounded-[24px] border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Choose players</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {players.map((player) => (
            <label key={player.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
              <input type="checkbox" checked={selectedPlayerIds.includes(player.id)} onChange={() => togglePlayer(player.id)} />
              <span>{player.displayName}</span>
            </label>
          ))}
        </div>
        <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-200">
          Number of tables
          <input type="number" min={1} max={6} value={numberOfTables} onChange={(event) => setNumberOfTables(Number(event.target.value) || 1)} className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-3 py-3 text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
        </label>
        <button onClick={generateArrangement} className="mt-4 rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400">
          Generate draft arrangement
        </button>
      </section>

      {arrangement && (
        <section className="rounded-[24px] border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Draft tables</h2>
            <button onClick={saveArrangement} className="rounded-2xl border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-100">Save arrangement</button>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {Object.entries(arrangement.tables).map(([tableName, tablePlayers]) => (
              <div key={tableName} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{tableName}</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {tablePlayers.map((playerId) => (
                    <div key={playerId} className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {players.find((player) => player.id === playerId)?.displayName ?? playerId}
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {arrangement.sideline.length > 0 && (
              <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Sideline</h3>
                <div className="mt-3 flex flex-wrap gap-2">
                  {arrangement.sideline.map((playerId) => (
                    <div key={playerId} className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200">
                      {players.find((player) => player.id === playerId)?.displayName ?? playerId}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          {message && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">{message}</p>}
        </section>
      )}
    </main>
  )
}
