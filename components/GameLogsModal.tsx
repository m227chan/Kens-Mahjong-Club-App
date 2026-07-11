'use client'

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import {
  createPlayer,
  importGames,
  subscribeActiveSession,
  subscribeGames,
  subscribePlayers
} from '@/lib/firestore'
import type { GameDoc, PlayerDoc, SeasonDoc, SessionDoc } from '@/lib/types'
import { randomUnusedPlayerEmoji } from '@/lib/players'

type ViewMode = 'all' | 'session' | 'player'

function csvEscape(value: string | number | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value)
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

function parseCsv(text: string) {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i]
    const next = text[i + 1]

    if (char === '"' && quoted && next === '"') {
      cell += '"'
      i += 1
    } else if (char === '"') {
      quoted = !quoted
    } else if (char === ',' && !quoted) {
      row.push(cell.trim())
      cell = ''
    } else if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1
      row.push(cell.trim())
      if (row.some(Boolean)) rows.push(row)
      row = []
      cell = ''
    } else {
      cell += char
    }
  }

  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

function normalizeName(value: string) {
  return value.trim().toLocaleLowerCase()
}

function parseCsvDate(value: string) {
  const text = value.trim()
  if (!text) return null

  const nativeDate = new Date(text)
  if (Number.isFinite(nativeDate.getTime())) return nativeDate

  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/)
  if (!match) return null

  const [, dayText, monthText, yearText, hourText = '0', minuteText = '0', secondText = '0'] = match
  const day = Number(dayText)
  const month = Number(monthText)
  const year = Number(yearText)
  const hour = Number(hourText)
  const minute = Number(minuteText)
  const second = Number(secondText)
  const parsed = new Date(year, month - 1, day, hour, minute, second)

  if (
    parsed.getFullYear() !== year
    || parsed.getMonth() !== month - 1
    || parsed.getDate() !== day
    || parsed.getHours() !== hour
    || parsed.getMinutes() !== minute
    || parsed.getSeconds() !== second
  ) {
    return null
  }

  return parsed
}

function parseScore(value: string) {
  const trimmed = value.trim()
  if (!trimmed) return null
  const normalized = trimmed.replace(/,/g, '')
  const score = Number(normalized)
  return Number.isFinite(score) ? score : null
}

function formatDate(game: GameDoc) {
  const date = game.datetime?.toDate?.()
  return date ? date.toLocaleString() : ''
}


export default function GameLogsModal({
  clubId,
  seasons,
  currentSeason,
  userId,
  onClose
}: {
  clubId: string
  seasons: SeasonDoc[]
  currentSeason: number
  userId: string
  onClose: () => void
}) {
  const [players, setPlayers] = useState<PlayerDoc[]>([])
  const [games, setGames] = useState<GameDoc[]>([])
  const [session, setSession] = useState<SessionDoc | null>(null)
  const [seasonFilter, setSeasonFilter] = useState<number | 'all'>(currentSeason)
  const [viewMode, setViewMode] = useState<ViewMode>('all')
  const [selectedPlayerId, setSelectedPlayerId] = useState('')
  const [importMessage, setImportMessage] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => subscribePlayers(clubId, setPlayers), [clubId])
  useEffect(() => subscribeGames(clubId, setGames), [clubId])
  useEffect(() => subscribeActiveSession(clubId, currentSeason, setSession), [clubId, currentSeason])

  useEffect(() => {
    setSeasonFilter(currentSeason)
  }, [currentSeason])

  const playerById = useMemo(() => new Map(players.map((player) => [player.id, player])), [players])

  const filteredGames = useMemo(() => {
    return games
      .filter((game) => seasonFilter === 'all' || (game.seasonNumber ?? 1) === seasonFilter)
      .sort((a, b) => (a.datetime?.toMillis?.() ?? 0) - (b.datetime?.toMillis?.() ?? 0))
  }, [games, seasonFilter])

  const displayedGames = useMemo(() => {
    if (viewMode !== 'player' || !selectedPlayerId) return filteredGames
    return filteredGames.filter((game) => game.entries.some((entry) => entry.playerId === selectedPlayerId))
  }, [filteredGames, selectedPlayerId, viewMode])

  const displayedPlayers = useMemo(() => {
    if (viewMode === 'session') {
      return players.filter((player) => session?.participants.includes(player.id))
    }

    if (viewMode === 'player' && selectedPlayerId) {
      const ids = new Set<string>([selectedPlayerId])
      displayedGames.forEach((game) => {
        if (game.entries.some((entry) => entry.playerId === selectedPlayerId)) {
          game.entries.forEach((entry) => ids.add(entry.playerId))
        }
      })
      return players.filter((player) => ids.has(player.id))
    }

    const ids = new Set(displayedGames.flatMap((game) => game.entries.map((entry) => entry.playerId)))
    return players.filter((player) => ids.has(player.id))
  }, [displayedGames, players, selectedPlayerId, session?.participants, viewMode])

  const buildCsvRows = (sourceGames: GameDoc[], sourcePlayers: PlayerDoc[]) => {
    const headers = ['datetime', 'season', 'tableId', 'winType', 'winner', 'loser', 'fan', 'notes', ...sourcePlayers.map((player) => player.displayName)]
    const rows = sourceGames.map((game) => {
      const scoreByPlayer = new Map(game.entries.map((entry) => [entry.playerId, entry.score]))
      return [
        game.datetime?.toDate?.()?.toISOString() ?? '',
        game.seasonNumber ?? 1,
        game.tableId ?? '',
        game.winType,
        game.winnerPlayerId ? playerById.get(game.winnerPlayerId)?.displayName ?? game.winnerPlayerId : '',
        game.loserPlayerId ? playerById.get(game.loserPlayerId)?.displayName ?? game.loserPlayerId : '',
        game.fan ?? '',
        game.notes ?? '',
        ...sourcePlayers.map((player) => scoreByPlayer.has(player.id) ? scoreByPlayer.get(player.id) ?? '' : '')
      ]
    })
    return [headers, ...rows]
  }

  const exportCsv = () => {
    const allGamePlayerIds = new Set(games.flatMap((game) => game.entries.map((entry) => entry.playerId)))
    const allGamePlayers = players.filter((player) => allGamePlayerIds.has(player.id))
    const rows = buildCsvRows(games, allGamePlayers)
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${clubId}-game-logs.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImport = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setImportMessage(null)
    setImporting(true)
    try {
      const rows = parseCsv(await file.text())
      const [headers, ...dataRows] = rows
      if (!headers?.length) {
        setImportMessage('That CSV does not have a header row.')
        return
      }

      const normalizedHeaders = headers.map((header) => normalizeName(header))
      const datetimeIndex = normalizedHeaders.indexOf('datetime')
      const seasonIndex = normalizedHeaders.indexOf('season')
      const ignored = new Set(['datetime', 'season', 'tableid', 'table id', 'wintype', 'win type', 'winner', 'loser', 'fan', 'notes'])
      const playerColumns = headers
        .map((header, index) => ({ name: header.trim(), index }))
        .filter((column) => column.name && !ignored.has(normalizeName(column.name)))

      const existingByName = new Map(players.map((player) => [normalizeName(player.displayName), player]))
      const parsedGamesByName: Array<{
        datetime?: Timestamp
        seasonNumber: number
        entries: Array<{ playerName: string; score: number }>
        notes: string
      }> = []
      const skippedRows: string[] = []

      dataRows.forEach((row, index) => {
        const rowNumber = index + 2
        const dateText = datetimeIndex >= 0 ? row[datetimeIndex] ?? '' : ''
        const date = dateText ? parseCsvDate(dateText) : null
        if (dateText && !date) {
          skippedRows.push(`row ${rowNumber}: invalid datetime`)
          return
        }

        const scoredEntries = playerColumns
          .map((column) => {
            const score = parseScore(row[column.index] ?? '')
            return score === null ? null : { playerName: column.name, score }
          })
          .filter((entry): entry is { playerName: string; score: number } => Boolean(entry))

        let entries = scoredEntries
        if (entries.length > 4) {
          const nonZeroEntries = entries.filter((entry) => entry.score !== 0)
          if (nonZeroEntries.length === 4) {
            entries = nonZeroEntries
          } else {
            skippedRows.push(`row ${rowNumber}: ambiguous player list (${entries.length} filled scores, ${nonZeroEntries.length} non-zero)`)
            return
          }
        }

        if (entries.length !== 4) {
          skippedRows.push(`row ${rowNumber}: expected 4 players, found ${entries.length}`)
          return
        }

        const totalScore = entries.reduce((sum, entry) => sum + entry.score, 0)
        if (totalScore !== 0) {
          skippedRows.push(`row ${rowNumber}: scores sum to ${totalScore}`)
          return
        }

        parsedGamesByName.push({
          datetime: date ? Timestamp.fromDate(date) : undefined,
          seasonNumber: seasonIndex >= 0 && row[seasonIndex] ? Number(row[seasonIndex]) || currentSeason : currentSeason,
          entries,
          notes: `Imported from CSV row ${rowNumber}`
        })
      })

      if (parsedGamesByName.length === 0) {
        const examples = skippedRows.slice(0, 4).join('; ')
        setImportMessage(`No valid four-player games found. ${examples ? `Skipped examples: ${examples}.` : ''}`)
        return
      }

      const requiredNames = Array.from(new Set(parsedGamesByName.flatMap((game) => game.entries.map((entry) => entry.playerName))))
      const missingNames = requiredNames.filter((name) => !existingByName.has(normalizeName(name)))

      if (missingNames.length > 0) {
        const confirmed = window.confirm(`Import includes ${missingNames.length} new player(s):\n\n${missingNames.join(', ')}\n\nAdd them to this club and continue?`)
        if (!confirmed) {
          setImportMessage('Import cancelled.')
          return
        }

        const usedIcons = new Set(players.map((player) => player.icon.trim().toLocaleLowerCase()))
        for (const name of missingNames) {
          const playerId = await createPlayer(clubId, { displayName: name, icon: randomUnusedPlayerEmoji(usedIcons) })
          existingByName.set(normalizeName(name), { id: playerId, displayName: name } as PlayerDoc)
        }
      }

      const parsedGames = parsedGamesByName.map((game) => ({
        datetime: game.datetime,
        seasonNumber: game.seasonNumber,
        entries: game.entries.map((entry) => {
          const player = existingByName.get(normalizeName(entry.playerName))
          if (!player) throw new Error(`Player ${entry.playerName} was not created.`)
          return { playerId: player.id, score: entry.score }
        }),
        notes: game.notes
      }))

      if (parsedGames.length === 0) {
        setImportMessage('No valid four-player games found in that CSV.')
        return
      }

      await importGames(clubId, { games: parsedGames, createdBy: userId })
      const skippedText = skippedRows.length ? ` Skipped ${skippedRows.length} ambiguous or invalid row${skippedRows.length === 1 ? '' : 's'}.` : ''
      setImportMessage(`Imported ${parsedGames.length} game${parsedGames.length === 1 ? '' : 's'}.${skippedText}`)
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Unable to import CSV.')
    } finally {
      setImporting(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <div className="flex max-h-[92vh] w-full max-w-7xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">Game logs</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">Club game score table</h3>
            <p className="mt-1 text-sm text-slate-500">Wide table by player, with one row per recorded game.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportCsv} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white hover:bg-emerald-500">
              Export CSV
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing} className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-bold text-white hover:bg-sky-500 disabled:opacity-50">
              {importing ? 'Importing...' : 'Import CSV'}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600">
              Close
            </button>
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleImport} className="hidden" />
          </div>
        </div>

        <div className="border-b border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <label className="text-xs font-bold uppercase tracking-[0.14em] text-slate-500">
              Season
              <select value={seasonFilter} onChange={(event) => setSeasonFilter(event.target.value === 'all' ? 'all' : Number(event.target.value))} className="mt-2 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold normal-case tracking-normal text-slate-700">
                <option value="all">All seasons</option>
                {seasons.map((season) => (
                  <option key={season.id} value={season.seasonNumber}>{season.name}</option>
                ))}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setViewMode('all')} className={`rounded-lg border px-3 py-2 text-sm font-bold ${viewMode === 'all' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                Show all data
              </button>
              <button type="button" onClick={() => setViewMode('session')} className={`rounded-lg border px-3 py-2 text-sm font-bold ${viewMode === 'session' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                Show session player&apos;s game scores
              </button>
              <button type="button" onClick={() => setViewMode('player')} className={`rounded-lg border px-3 py-2 text-sm font-bold ${viewMode === 'player' ? 'border-sky-500 bg-sky-50 text-sky-700' : 'border-slate-200 bg-white text-slate-600'}`}>
                Specific player
              </button>
            </div>
            {viewMode === 'player' ? (
              <select value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.target.value)} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700">
                <option value="">Select player</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id}>{player.displayName}</option>
                ))}
              </select>
            ) : null}
          </div>
          {importMessage ? <p className="mt-3 text-sm font-semibold text-slate-600">{importMessage}</p> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          <table className="min-w-full border-separate border-spacing-0 text-sm">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-20 border-b border-slate-200 bg-slate-100 px-3 py-2 text-left font-black text-slate-700">Datetime</th>
                <th className="sticky top-0 z-10 border-b border-slate-200 bg-slate-100 px-3 py-2 text-left font-black text-slate-700">Season</th>
                {displayedPlayers.map((player) => (
                  <th key={player.id} className="sticky top-0 z-10 min-w-[120px] border-b border-slate-200 bg-slate-100 px-3 py-2 text-left font-black text-slate-700">{player.displayName}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {displayedGames.map((game) => {
                const scoreByPlayer = new Map(game.entries.map((entry) => [entry.playerId, entry.score]))
                return (
                  <tr key={game.id} className="odd:bg-white even:bg-slate-50">
                    <td className="sticky left-0 z-10 whitespace-nowrap border-b border-slate-100 bg-inherit px-3 py-2 font-semibold text-slate-700">{formatDate(game)}</td>
                    <td className="whitespace-nowrap border-b border-slate-100 px-3 py-2 text-slate-600">Season {game.seasonNumber ?? 1}</td>
                    {displayedPlayers.map((player) => {
                      const score = scoreByPlayer.get(player.id)
                      return (
                        <td key={player.id} className={`border-b border-slate-100 px-3 py-2 font-bold ${score === undefined ? 'text-slate-300' : score > 0 ? 'text-emerald-700' : score < 0 ? 'text-rose-700' : 'text-slate-700'}`}>
                          {score === undefined ? '' : score}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
          {displayedGames.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-slate-50 p-10 text-center text-sm font-semibold text-slate-500">
              No games match these filters.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
