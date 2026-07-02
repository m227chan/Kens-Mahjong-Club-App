'use client'

import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { createGame, subscribePlayers } from '@/lib/firestore'
import type { PlayerDoc } from '@/lib/types'

const FAN_TO_POINTS: Record<number, number> = {
  3: 8,
  4: 16,
  5: 24,
  6: 32,
  7: 48,
  8: 64,
  9: 96,
  10: 128,
  11: 192,
  12: 256,
  13: 384
}

type WinType = 'self-draw' | 'discard' | 'draw'

type DraftTable = {
  id: string
  name: string
  players: string[]
}

export default function SessionManager() {
  const { user, loading, isAdmin } = useAuth()
  const [players, setPlayers] = useState<PlayerDoc[]>([])
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([])
  const [tables, setTables] = useState<DraftTable[]>([])
  const [tableCount, setTableCount] = useState(2)
  const [fan, setFan] = useState(3)
  const [winType, setWinType] = useState<WinType>('self-draw')
  const [winnerId, setWinnerId] = useState<string>('')
  const [discarderId, setDiscarderId] = useState<string>('')
  const [notes, setNotes] = useState('')
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => subscribePlayers((nextPlayers) => setPlayers(nextPlayers)), [])

  useEffect(() => {
    const nextTables = Array.from({ length: tableCount }, (_, index) => ({ id: `table-${index + 1}`, name: `Table ${index + 1}`, players: [] }))
    setTables(nextTables)
  }, [tableCount])

  useEffect(() => {
    setTables((current) =>
      current.map((table) => ({
        ...table,
        players: table.players.filter((playerId) => selectedPlayerIds.includes(playerId))
      }))
    )
  }, [selectedPlayerIds])

  const availablePlayers = useMemo(() => {
    return players.filter((player) => selectedPlayerIds.includes(player.id))
  }, [players, selectedPlayerIds])

  const addPlayerToTable = (playerId: string, tableId: string) => {
    setTables((current) => current.map((table) => {
      if (table.id !== tableId) return table
      if (table.players.length >= 4 || table.players.includes(playerId)) return table
      return { ...table, players: [...table.players, playerId] }
    }))
  }

  const removePlayerFromTable = (playerId: string, tableId: string) => {
    setTables((current) => current.map((table) => table.id === tableId ? { ...table, players: table.players.filter((id) => id !== playerId) } : table))
  }

  const availableSideline = useMemo(() => {
    const tablePlayers = tables.flatMap((table) => table.players)
    return availablePlayers.filter((player) => !tablePlayers.includes(player.id))
  }, [availablePlayers, tables])

  const activeTable = useMemo(() => tables.find((table) => table.players.length === 4) ?? tables[0], [tables])
  const activeTablePlayers = useMemo(() => {
    return players.filter((player) => activeTable?.players.includes(player.id))
  }, [players, activeTable])

  const handleTogglePlayer = (playerId: string) => {
    setSelectedPlayerIds((current) => current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId])
  }

  useEffect(() => {
    if (winType === 'draw') {
      setWinnerId('')
      setDiscarderId('')
    }
    if (winType === 'self-draw') {
      setDiscarderId('')
    }
  }, [winType])

  const scorePreview = useMemo(() => {
    const scores: Record<string, number> = {}
    activeTablePlayers.forEach((player) => { scores[player.id] = 0 })

    if (winType === 'draw') {
      return scores
    }

    const points = FAN_TO_POINTS[fan] ?? 0
    if (winType === 'self-draw' && winnerId) {
      scores[winnerId] = points * 3
      activeTablePlayers.forEach((player) => {
        if (player.id !== winnerId) scores[player.id] = -points
      })
    } else if (winType === 'discard' && winnerId && discarderId) {
      scores[winnerId] = points * 2
      scores[discarderId] = -points * 2
      activeTablePlayers.forEach((player) => {
        if (!scores[player.id]) scores[player.id] = 0
      })
    }

    return scores
  }, [activeTablePlayers, fan, winType, winnerId, discarderId])

  const handleSubmitGame = async () => {
    if (!user) {
      setMessage('Sign in to record games.')
      return
    }

    if (!isAdmin) {
      setMessage('Only admins can record session games.')
      return
    }

    if (!winnerId && winType !== 'draw') {
      setMessage('Select the round winner before recording the game.')
      return
    }

    if (winType === 'discard' && !discarderId) {
      setMessage('Select the discarder for a discard win.')
      return
    }

    const table = tables.find((table) => table.players.length === 4)
    if (!table) {
      setMessage('Fill one table with exactly 4 players to record a game.')
      return
    }

    const entries = table.players.map((playerId) => ({ playerId, score: scorePreview[playerId] ?? 0 }))
    const totalScore = entries.reduce((sum, entry) => sum + entry.score, 0)
    if (totalScore !== 0) {
      setMessage('Score preview is invalid. Scores must sum to zero.')
      return
    }

    try {
      await createGame({
        entries,
        createdBy: user.uid,
        tableId: table.id,
        winType: winType === 'self-draw' ? 'self_draw' : winType,
        loserPlayerId: winType === 'discard' ? discarderId : null,
        fan: winType === 'draw' ? null : fan,
        notes: notes.trim() || null
      })
      setMessage('Game recorded successfully.')
      setWinnerId('')
      setDiscarderId('')
      setNotes('')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save game.')
    }
  }

  return (
    <aside className="space-y-6 rounded-[24px] border border-zinc-200/70 bg-white/80 p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80 lg:w-[420px]">
      <div>
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-500">Session manager</p>
        <h2 className="mt-3 text-xl font-semibold text-zinc-900 dark:text-zinc-100">Live game entry</h2>
        <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-300">Select players, seat them and record a round from one table.</p>
      </div>

      <div className="space-y-4">
        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Players</p>
          <div className="mt-3 grid gap-2 max-h-40 overflow-auto">
            {players.map((player) => (
              <label key={player.id} className="flex items-center gap-3 rounded-2xl border border-zinc-200 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-200">
                <input type="checkbox" checked={selectedPlayerIds.includes(player.id)} onChange={() => handleTogglePlayer(player.id)} />
                <span>{player.displayName}</span>
              </label>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Table draft</p>
          <div className="mt-3 grid gap-3">
            {tables.map((table) => (
              <div key={table.id} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
                <div className="flex items-center justify-between text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                  <span>{table.name}</span>
                  <span>{table.players.length}/4</span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {table.players.map((playerId) => (
                    <button
                      key={playerId}
                      type="button"
                      onClick={() => removePlayerFromTable(playerId, table.id)}
                      className="rounded-full bg-zinc-100 px-3 py-1 text-xs text-zinc-700 transition hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                    >
                      {players.find((player) => player.id === playerId)?.displayName ?? playerId} ✕
                    </button>
                  ))}
                </div>
                <div className="mt-3 grid gap-2">
                  {availableSideline.map((player) => (
                    <button
                      key={`${table.id}-${player.id}`}
                      type="button"
                      onClick={() => addPlayerToTable(player.id, table.id)}
                      className="rounded-2xl border border-zinc-300 px-3 py-2 text-left text-sm text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      {player.displayName}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950/50">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Round details</p>
          <div className="grid gap-3">
            <label className="block text-sm text-zinc-700 dark:text-zinc-200">
              Win type
              <select value={winType} onChange={(event) => setWinType(event.target.value as WinType)} className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                <option value="self-draw">Self-draw</option>
                <option value="discard">Discard win</option>
                <option value="draw">Draw</option>
              </select>
            </label>

            <label className="block text-sm text-zinc-700 dark:text-zinc-200">
              Fan count
              <input type="number" min={3} max={13} value={fan} onChange={(event) => setFan(Number(event.target.value) || 3)} className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </label>

            <label className="block text-sm text-zinc-700 dark:text-zinc-200">
              Winner
              <select value={winnerId} onChange={(event) => setWinnerId(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                <option value="">Select winner</option>
                {activeTablePlayers.map((player) => (
                  <option key={player.id} value={player.id}>{player.displayName}</option>
                ))}
              </select>
            </label>

            {winType === 'discard' && (
              <label className="block text-sm text-zinc-700 dark:text-zinc-200">
                Discarder
                <select value={discarderId} onChange={(event) => setDiscarderId(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100">
                  <option value="">Select discarder</option>
                  {activeTablePlayers.filter((player) => player.id !== winnerId).map((player) => (
                    <option key={player.id} value={player.id}>{player.displayName}</option>
                  ))}
                </select>
              </label>
            )}

            <label className="block text-sm text-zinc-700 dark:text-zinc-200">
              Notes
              <input type="text" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Optional notes" className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-3 py-2 text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
            </label>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-950/50">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Score preview</p>
          <div className="mt-3 grid gap-2">
            {activeTablePlayers.map((player) => (
              <div key={player.id} className="flex items-center justify-between rounded-2xl bg-white px-3 py-2 text-sm text-zinc-700 shadow-sm dark:bg-zinc-800 dark:text-zinc-200">
                <span>{player.displayName}</span>
                <span>{scorePreview[player.id] ?? 0}</span>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={handleSubmitGame}
          className="w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          disabled={!user || loading || !isAdmin}
        >
          Record game
        </button>

        {message && <p className="rounded-2xl border border-zinc-200 bg-zinc-50 px-4 py-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-200">{message}</p>}
      </div>
    </aside>
  )
}
