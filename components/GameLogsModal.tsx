'use client'

import { ChangeEvent, useEffect, useMemo, useRef, useState } from 'react'
import { Timestamp } from 'firebase/firestore'
import {
  createPlayer,
  invalidateClubHistoryCache,
  importGames,
  loadAllGames,
  loadGamesPage,
  subscribeActiveSession,
  subscribePlayers
} from '@/lib/firestore'
import { auth } from '@/lib/firebase'
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
  canDeleteGames,
  onClose
}: {
  clubId: string
  seasons: SeasonDoc[]
  currentSeason: number
  userId: string
  canDeleteGames: boolean
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
  const [selectedGame, setSelectedGame] = useState<GameDoc | null>(null)
  const [draftScores, setDraftScores] = useState<Record<string, string>>({})
  const [draftDate, setDraftDate] = useState('')
  const [draftSeason, setDraftSeason] = useState(currentSeason)
  const [draftNotes, setDraftNotes] = useState('')
  const [savingGame, setSavingGame] = useState(false)
  const [loadingGames, setLoadingGames] = useState(true)
  const [loadingOlderGames, setLoadingOlderGames] = useState(false)
  const [hasOlderGames, setHasOlderGames] = useState(true)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => subscribePlayers(clubId, setPlayers), [clubId])
  useEffect(() => {
    let cancelled = false
    setLoadingGames(true)
    void loadGamesPage(clubId).then((nextGames) => {
      if (!cancelled) { setGames(nextGames); setHasOlderGames(nextGames.length === 100) }
    }).catch((error) => {
      if (!cancelled) setImportMessage(error instanceof Error ? error.message : 'Unable to load game logs.')
    }).finally(() => { if (!cancelled) setLoadingGames(false) })
    return () => { cancelled = true }
  }, [clubId])
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

  const exportCsv = async () => {
    const exportGames = await loadAllGames(clubId)
    const allGamePlayerIds = new Set(exportGames.flatMap((game) => game.entries.map((entry) => entry.playerId)))
    const allGamePlayers = players.filter((player) => allGamePlayerIds.has(player.id))
    const rows = buildCsvRows(exportGames, allGamePlayers)
    const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${clubId}-game-logs.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const openGame = (game: GameDoc) => {
    if (!canDeleteGames) return
    const date = game.datetime.toDate()
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
    setSelectedGame(game)
    setDraftScores(Object.fromEntries(game.entries.map((entry) => [entry.playerId, String(entry.score)])))
    setDraftDate(local)
    setDraftSeason(game.seasonNumber ?? 1)
    setDraftNotes(game.notes ?? '')
    setImportMessage(null)
  }

  const mutateGame = async (action: 'update' | 'delete') => {
    if (!selectedGame || !canDeleteGames) return
    if (action === 'delete' && !window.confirm(`Permanently delete the game from ${formatDate(selectedGame)}? All club statistics and ELO history will be rebuilt.`)) return
    const entries = selectedGame.entries.map((entry) => ({ playerId: entry.playerId, score: Number(draftScores[entry.playerId]) }))
    if (action === 'update' && (entries.some((entry) => !Number.isFinite(entry.score)) || entries.reduce((sum, entry) => sum + entry.score, 0) !== 0)) {
      setImportMessage('Enter four valid scores that add up to zero.')
      return
    }
    setSavingGame(true)
    setImportMessage(null)
    try {
      const token = await auth.currentUser?.getIdToken()
      if (!token) throw new Error('Sign in again before modifying a game.')
      const response = await fetch('/api/games/mutate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ clubId, gameId: selectedGame.id, action, ...(action === 'update' ? {
          game: { datetime: new Date(draftDate).toISOString(), seasonNumber: draftSeason, entries, notes: draftNotes }
        } : {}) })
      })
      const result = await response.json() as { error?: string }
      if (!response.ok) throw new Error(result.error ?? 'Unable to modify game.')
      invalidateClubHistoryCache(clubId)
      if (action === 'delete') {
        setGames((current) => current.filter((game) => game.id !== selectedGame.id))
      } else {
        const updated: GameDoc = { ...selectedGame, datetime: Timestamp.fromDate(new Date(draftDate)), seasonNumber: draftSeason, entries, notes: draftNotes.trim() || null }
        setGames((current) => current.map((game) => game.id === updated.id ? updated : game).sort((a, b) => a.datetime.toMillis() - b.datetime.toMillis()))
      }
      setSelectedGame(null)
      setImportMessage(action === 'delete' ? 'Game deleted and all club statistics recalculated.' : 'Game updated and all club statistics recalculated.')
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Unable to modify game.')
    } finally {
      setSavingGame(false)
    }
  }

  const loadOlderGames = async () => {
    const oldest = games[0]?.datetime?.toMillis?.()
    if (!oldest || loadingOlderGames) return
    setLoadingOlderGames(true)
    try {
      const older = await loadGamesPage(clubId, 100, oldest)
      setGames((current) => [...older, ...current])
      setHasOlderGames(older.length === 100)
    } catch (error) {
      setImportMessage(error instanceof Error ? error.message : 'Unable to load older games.')
    } finally {
      setLoadingOlderGames(false)
    }
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


      const requiredNames = Array.from(new Set(playerColumns.map((column) => column.name)))
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

      if (parsedGamesByName.length === 0) {
        const examples = skippedRows.slice(0, 4).join('; ')
        const playerText = missingNames.length ? `Added ${missingNames.length} new player${missingNames.length === 1 ? '' : 's'} from the CSV headers. ` : ''
        setImportMessage(`${playerText}No valid four-player games were found to import.${examples ? ` Skipped examples: ${examples}.` : ''}`)
        return
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
    <div className="responsive-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
      <div className="responsive-modal-panel flex max-h-[92vh] w-full max-w-7xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl">
        <div className="flex flex-col gap-4 border-b border-slate-200 p-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-sky-600">Game logs</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">Club game score table</h3>
            <p className="mt-1 text-sm text-slate-500">One record per game. {canDeleteGames ? 'Select a record to review or edit it.' : ''}</p>
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
          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-semibold text-slate-500">
            <span>{loadingGames ? 'Loading recent games…' : `${games.length.toLocaleString()} game records loaded`}</span>
            {hasOlderGames && !loadingGames ? <button type="button" onClick={loadOlderGames} disabled={loadingOlderGames} className="rounded border border-slate-300 bg-white px-3 py-1.5 font-bold text-slate-700 disabled:opacity-50">{loadingOlderGames ? 'Loading…' : 'Load 100 older games'}</button> : null}
          </div>
          {importMessage ? <p className="mt-3 text-sm font-semibold text-slate-600">{importMessage}</p> : null}
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-3 sm:p-4">
          <div className="grid gap-3 md:hidden">
            {displayedGames.map((game) => (
              <button key={game.id} type="button" onClick={() => openGame(game)} disabled={!canDeleteGames} className="rounded border border-slate-200 bg-white p-4 text-left shadow-sm transition enabled:hover:border-[rgb(var(--bamboo))] enabled:active:scale-[.99] disabled:cursor-default">
                <span className="flex items-start justify-between gap-3">
                  <span><strong className="block text-sm text-slate-900">{formatDate(game)}</strong><span className="mt-1 block text-xs font-semibold text-slate-500">Season {game.seasonNumber ?? 1}</span></span>
                  {canDeleteGames ? <span className="text-xs font-bold text-[rgb(var(--bamboo))]">Review →</span> : null}
                </span>
                <span className="mt-3 grid grid-cols-2 gap-2">
                  {game.entries.map((entry) => (
                    <span key={entry.playerId} className="flex items-center justify-between gap-2 rounded bg-slate-50 px-2.5 py-2 text-xs">
                      <span className="truncate font-semibold text-slate-700">{playerById.get(entry.playerId)?.displayName ?? 'Player'}</span>
                      <strong className={entry.score > 0 ? 'text-emerald-700' : entry.score < 0 ? 'text-rose-700' : 'text-slate-700'}>{entry.score}</strong>
                    </span>
                  ))}
                </span>
              </button>
            ))}
          </div>

          <table className="game-log-table hidden min-w-full border-separate border-spacing-0 text-sm md:table">
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
                  <tr key={game.id} onClick={() => openGame(game)} onKeyDown={(event) => { if (canDeleteGames && (event.key === 'Enter' || event.key === ' ')) openGame(game) }} tabIndex={canDeleteGames ? 0 : undefined} title={canDeleteGames ? 'Select to review, edit, or delete this game' : undefined} className={`game-log-row ${canDeleteGames ? 'cursor-pointer outline-none hover:ring-2 hover:ring-inset hover:ring-[rgb(var(--bamboo))] focus:ring-2 focus:ring-inset focus:ring-[rgb(var(--bamboo))]' : ''}`}>
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

      {selectedGame ? (
        <div className="responsive-modal fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget && !savingGame) setSelectedGame(null) }}>
          <div className="responsive-modal-panel max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-lg border border-slate-200 bg-white p-5 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div><p className="text-xs font-bold uppercase tracking-[.16em] text-[rgb(var(--bamboo))]">Game record</p><h4 className="mt-2 text-xl font-black text-slate-950">Review and update</h4></div>
              <button type="button" onClick={() => setSelectedGame(null)} disabled={savingGame} className="rounded border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600">Close</button>
            </div>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <label className="text-sm font-bold text-slate-700">Date and time<input type="datetime-local" value={draftDate} onChange={(event) => setDraftDate(event.target.value)} className="mt-2 min-h-11 w-full rounded border border-slate-300 bg-white px-3 text-slate-900" /></label>
              <label className="text-sm font-bold text-slate-700">Season<select value={draftSeason} onChange={(event) => setDraftSeason(Number(event.target.value))} className="mt-2 min-h-11 w-full rounded border border-slate-300 bg-white px-3 text-slate-900">{seasons.map((season) => <option key={season.id} value={season.seasonNumber}>{season.name}</option>)}</select></label>
            </div>
            <div className="mt-5">
              <p className="text-sm font-bold text-slate-700">Player scores <span className="font-normal text-slate-500">(must total zero)</span></p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {selectedGame.entries.map((entry) => (
                  <label key={entry.playerId} className="flex items-center justify-between gap-3 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                    <span className="truncate">{playerById.get(entry.playerId)?.icon} {playerById.get(entry.playerId)?.displayName ?? entry.playerId}</span>
                    <input type="number" value={draftScores[entry.playerId] ?? ''} onChange={(event) => setDraftScores((current) => ({ ...current, [entry.playerId]: event.target.value }))} className="w-24 rounded border border-slate-300 bg-white px-2 py-1.5 text-right font-mono font-bold text-slate-900" />
                  </label>
                ))}
              </div>
            </div>
            <label className="mt-5 block text-sm font-bold text-slate-700">Notes<textarea value={draftNotes} onChange={(event) => setDraftNotes(event.target.value)} rows={3} className="mt-2 w-full resize-y rounded border border-slate-300 bg-white p-3 text-slate-900" /></label>
            <p className="mt-3 text-xs leading-5 text-slate-500">Saving or deleting rebuilds points, ELO ratings, rankings, win rates, titles, and analytics from the complete game history.</p>
            {importMessage ? <p className="mt-3 rounded border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">{importMessage}</p> : null}
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-between">
              <button type="button" onClick={() => mutateGame('delete')} disabled={savingGame} className="min-h-11 rounded border border-rose-300 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Delete game</button>
              <button type="button" onClick={() => mutateGame('update')} disabled={savingGame || !draftDate} className="min-h-11 rounded bg-[rgb(var(--bamboo))] px-5 py-2 text-sm font-bold text-white disabled:opacity-50">{savingGame ? 'Rebuilding statistics…' : 'Save changes'}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
