'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useSound } from '@/contexts/SoundContext'
import {
  closeSession,
  createGame,
  createSession,
  subscribeActiveSession,
  subscribePlayers,
  updateSession
} from '@/lib/data'
import type { PlayerDoc } from '@/lib/types'

const FAN_POINTS: Record<number, number> = {
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

type WinType = 'self' | 'discard' | 'draw'

type SessionState = {
  id?: string
  active: boolean
  tableCount: number
  participants: string[]
  tables: Record<string, string[]>
  sideline: string[]
}

type WinState = {
  tableId: string | null
  winner: string | null
  winType: WinType | null
  loser: string | null
  fan: number | null
}

const initialSession: SessionState = {
  active: false,
  tableCount: 1,
  participants: [],
  tables: {},
  sideline: []
}

const initialWinState: WinState = {
  tableId: null,
  winner: null,
  winType: null,
  loser: null,
  fan: null
}

export default function SessionManager({ clubId, seasonNumber, players: suppliedPlayers }: { clubId: string; seasonNumber: number; players?: PlayerDoc[] }) {
  const { user, loading, isAdmin } = useAuth()
  const { play } = useSound()
  const [subscribedPlayers, setSubscribedPlayers] = useState<PlayerDoc[]>([])
  const players = suppliedPlayers ?? subscribedPlayers
  const [session, setSession] = useState<SessionState>(initialSession)
  const [page, setPage] = useState<'loading' | 'setup' | 'session'>('loading')
  const [setupParticipants, setSetupParticipants] = useState<string[]>([])
  const [setupTableCount, setSetupTableCount] = useState(1)
  const [setupSearch, setSetupSearch] = useState('')
  const [tableSearch, setTableSearch] = useState('')
  const [pickerTableId, setPickerTableId] = useState<string | null>(null)
  const [pickerSearch, setPickerSearch] = useState('')
  const [swapPickerTableId, setSwapPickerTableId] = useState<string | null>(null)
  const [swapPickerPlayer, setSwapPickerPlayer] = useState<string | null>(null)
  const [swapPickerSearch, setSwapPickerSearch] = useState('')
  const [winState, setWinState] = useState<WinState>(initialWinState)
  const [savingGameTable, setSavingGameTable] = useState<string | null>(null)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [flash, setFlash] = useState<{ scores: Record<string, number>; winner: string | null } | null>(null)
  const [collapsedTables, setCollapsedTables] = useState<Record<string, boolean>>({})
  const [sidelineCollapsed, setSidelineCollapsed] = useState(false)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [infoOpen, setInfoOpen] = useState(false)
  const [savingSession, setSavingSession] = useState(false)

  const dragPlayerRef = useRef<string | null>(null)
  const dragSourceRef = useRef<string | null>(null)

  useEffect(() => {
    const playerUnsub = suppliedPlayers ? undefined : subscribePlayers(clubId, setSubscribedPlayers)
    const sessionUnsub = subscribeActiveSession(
      clubId,
      seasonNumber,
      (nextSession) => {
        if (nextSession && nextSession.isActive) {
          setSession({
            id: nextSession.id,
            active: true,
            tableCount: nextSession.tableCount,
            participants: nextSession.participants,
            tables: nextSession.tables,
            sideline: nextSession.sideline
          })
          setSetupParticipants(nextSession.participants)
          setSetupTableCount(nextSession.tableCount)
          setPage('session')
        } else {
          setSession(initialSession)
          setSetupParticipants([])
          setSetupTableCount(1)
          setPage('setup')
        }
      },
      (error) => {
        console.error('Unable to load active session.', error)
        setSession(initialSession)
        setSetupParticipants([])
        setSetupTableCount(1)
          setSetupError('Unable to load sessions for this club.')
        setPage('setup')
      }
    )

    return () => {
      playerUnsub?.()
      sessionUnsub()
    }
  }, [clubId, seasonNumber, suppliedPlayers])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(null), 2500)
    return () => window.clearTimeout(timer)
  }, [toast])

  useEffect(() => {
    if (!flash) return
    const timer = window.setTimeout(() => setFlash(null), 2200)
    return () => window.clearTimeout(timer)
  }, [flash])

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      if (!target.closest('#btnMenu') && !target.closest('#headerMenu')) {
        setHeaderMenuOpen(false)
      }
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const playerInfo = useCallback((playerId: string) => {
    const player = players.find((item) => item.id === playerId)
    return player ?? { id: playerId, displayName: playerId, icon: '👤' }
  }, [players])

  const shortName = (name: string) => {
    if (!name) return ''
    return name.length > 10 ? name.substring(0, 9) + '…' : name
  }

  const filteredSetupPlayers = useMemo(() => {
    const query = setupSearch.toLowerCase().trim()
    return players
      .slice()
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .filter((player) => player.displayName.toLowerCase().includes(query))
  }, [players, setupSearch])

  const setupCount = setupParticipants.length
  const sessionHeaderLabel = `${session.participants.length} players · ${session.tableCount} table${session.tableCount !== 1 ? 's' : ''}`

  const sessionParticipants = useMemo(() => {
    return players.filter((player) => session.participants.includes(player.id))
  }, [players, session.participants])

  const sessionTables = useMemo(() => {
    return Array.from({ length: session.tableCount }, (_, index) => session.tables[String(index + 1)] ?? [])
  }, [session.tableCount, session.tables])

  const assignedTablePlayers = sessionTables.flat()
  const sessionSideline = session.sideline || []

  const filteredTableCards = useMemo(() => {
    const query = tableSearch.toLowerCase().trim()
    return sessionTables.map((playersOnTable, index) => {
      const tableId = String(index + 1)
      const tableName = `Table ${tableId}`
      const playerNames = playersOnTable.map((id) => playerInfo(id).displayName.toLowerCase())
      const matches =
        !query ||
        tableName.toLowerCase().includes(query) ||
        playerNames.some((name) => name.includes(query))
      return { tableId, players: playersOnTable, visible: matches }
    })
  }, [playerInfo, sessionTables, tableSearch])

  const dragContext = { player: dragPlayerRef.current, source: dragSourceRef.current }

  const togglePlayerSetup = (playerId: string) => {
    setSetupParticipants((current) =>
      current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]
    )
  }

  const selectTableCount = (value: number) => {
    const nextCount = Math.min(99, Math.max(1, Math.floor(value)))
    setSetupTableCount(nextCount)
  }

  const selectAllPlayers = () => {
    setSetupParticipants(players.map((player) => player.id))
  }

  const clearAllPlayers = () => {
    setSetupParticipants([])
  }

  const showToast = (message: string) => {
    setToast(message)
  }

  const showSetupError = (message: string) => {
    setSetupError(message)
    window.setTimeout(() => setSetupError(null), 3000)
  }

  const persistSession = async (nextSession: SessionState) => {
    setSession(nextSession)
    if (!nextSession.id) return
    try {
      await updateSession(clubId, nextSession.id, {
        tableCount: nextSession.tableCount,
        participants: nextSession.participants,
        tables: nextSession.tables,
        sideline: nextSession.sideline
      })
    } catch {
      console.warn('Unable to persist session layout.')
    }
  }

  const startSession = async () => {
    if (setupParticipants.length < 4) {
      showSetupError('Select at least 4 players.')
      return
    }

    if (setupTableCount < 1) {
      showSetupError('Select number of tables.')
      return
    }

    const nextTables: Record<string, string[]> = {}
    for (let i = 1; i <= setupTableCount; i += 1) {
      const key = String(i)
      const prev = session.active ? session.tables[key] || [] : []
      nextTables[key] = prev.filter((playerId) => setupParticipants.includes(playerId))
    }

    const assigned = Object.values(nextTables).flat()
    const sideline = setupParticipants.filter((playerId) => !assigned.includes(playerId))

    const nextSession: SessionState = {
      active: true,
      id: session.id,
      tableCount: setupTableCount,
      participants: setupParticipants,
      tables: nextTables,
      sideline
    }

    setSavingSession(true)
    try {
      if (session.active && session.id) {
        await updateSession(clubId, session.id, {
          tableCount: setupTableCount,
          participants: setupParticipants,
          tables: nextTables,
          sideline
        })
        setSession(nextSession)
      } else {
        const sessionId = await createSession(clubId, {
          createdBy: user?.uid ?? 'anonymous',
          participants: setupParticipants,
          tableCount: setupTableCount,
          seasonNumber,
          tables: nextTables,
          sideline
        })
        setSession({ ...nextSession, id: sessionId })
      }
      setPage('session')
    } catch (error) {
      showSetupError(error instanceof Error ? error.message : 'Unable to start session.')
    } finally {
      setSavingSession(false)
    }
  }

  const closeAllWinPanels = () => {
    setWinState(initialWinState)
  }

  const openWinPanel = (tableId: string) => {
    const playersOnTable = session.tables[tableId] || []
    if (playersOnTable.length !== 4) return
    setWinState({ tableId, winner: null, winType: null, loser: null, fan: null })
  }

  const setWinner = (tableId: string, playerId: string) => {
    setWinState({ tableId, winner: playerId, winType: null, loser: null, fan: null })
  }

  const setWinType = (tableId: string, type: WinType) => {
    setWinState((current) => ({ ...current, winType: type, loser: type === 'self' ? null : current.loser }))
  }

  const setLoser = (tableId: string, playerId: string) => {
    setWinState((current) => ({ ...current, loser: playerId }))
  }

  const setFan = (tableId: string, value: number) => {
    setWinState((current) => ({ ...current, fan: value }))
  }

  const calcScores = () => {
    const { winner, winType: type, loser, fan: fanCount, tableId } = winState
    if (!winner || !type || !fanCount || !tableId) return null
    if (type === 'discard' && !loser) return null

    const playersOnTable = session.tables[tableId] || []
    const base = fanCount >= 13 ? 384 : FAN_POINTS[fanCount]
    if (!base) return null

    const scores: Record<string, number> = {}
    const nonWinners = playersOnTable.filter((playerId) => playerId !== winner)

    if (type === 'self') {
      scores[winner] = base * 3
      nonWinners.forEach((playerId) => {
        scores[playerId] = -base
      })
    } else {
      scores[winner] = base * 2
      scores[loser!] = -base * 2
      nonWinners.filter((playerId) => playerId !== loser).forEach((playerId) => {
        scores[playerId] = 0
      })
    }

    return scores
  }

  const submitWin = async (tableId: string) => {
    const scores = calcScores()
    if (!scores) { play('error'); return }
    if (!user) {
      play('error')
      showToast('Sign in to record games.')
      return
    }

    setSavingGameTable(tableId)
    try {
      await createGame(clubId, {
        entries: Object.entries(scores).map(([playerId, score]) => ({ playerId, score })),
        createdBy: user.uid,
        seasonNumber,
        tableId,
        winType: winState.winType === 'self' ? 'self_draw' : 'discard',
        loserPlayerId: winState.winType === 'discard' ? winState.loser : null,
        fan: winState.winType === 'draw' ? null : winState.fan,
        notes: null
      })
      play('win')
      setFlash({ scores, winner: winState.winner })
      closeAllWinPanels()
      setWinState(initialWinState)
    } catch (error) {
      play('error')
      showToast(error instanceof Error ? error.message : 'Unable to save game.')
    } finally {
      setSavingGameTable(null)
    }
  }

  const addDraw = async (tableId: string) => {
    const playersOnTable = session.tables[tableId] || []
    if (playersOnTable.length !== 4) { play('error'); return }

    const scores = Object.fromEntries(playersOnTable.map((playerId) => [playerId, 0])) as Record<string, number>
    if (!user) {
      play('error')
      showToast('Sign in to record games.')
      return
    }

    setSavingGameTable(tableId)
    try {
      await createGame(clubId, {
        entries: Object.entries(scores).map(([playerId, score]) => ({ playerId, score })),
        createdBy: user.uid,
        seasonNumber,
        tableId,
        winType: 'draw',
        loserPlayerId: null,
        fan: null,
        notes: null
      })
      play('draw')
      setFlash({ scores, winner: null })
      showToast('Draw saved.')
    } catch (error) {
      play('error')
      showToast(error instanceof Error ? error.message : 'Unable to save draw.')
    } finally {
      setSavingGameTable(null)
    }
  }

  const confirmClearSession = async () => {
    if (!window.confirm('Clear this session? Table assignments and participation will be reset.')) return
    if (session.id) {
      try {
        await closeSession(clubId, session.id)
      } catch {
        showToast('Unable to reset session.')
        return
      }
    }
    setSession(initialSession)
    setSetupParticipants([])
    setSetupTableCount(1)
    setPage('setup')
    showToast('Session cleared!')
  }

  const clearAllTables = async () => {
    const nextSideline = [...session.sideline]
    const nextTables: Record<string, string[]> = {}

    for (let i = 1; i <= session.tableCount; i += 1) {
      const key = String(i)
      const playersOnTable = session.tables[key] || []
      playersOnTable.forEach((playerId) => {
        if (!nextSideline.includes(playerId)) {
          nextSideline.push(playerId)
        }
      })
      nextTables[key] = []
    }

    const nextSession = { ...session, tables: nextTables, sideline: nextSideline }
    await persistSession(nextSession)
    play('tile')
    showToast('All tables cleared.')
  }

  const clearSingleTable = async (tableId: string) => {
    const playersOnTable = session.tables[tableId] || []
    const nextSideline = [...session.sideline]
    playersOnTable.forEach((playerId) => {
      if (!nextSideline.includes(playerId)) nextSideline.push(playerId)
    })
    const nextTables = { ...session.tables, [tableId]: [] }
    await persistSession({ ...session, tables: nextTables, sideline: nextSideline })
    play('tile')
    showToast('Table cleared.')
  }

  const removeToSideline = async (tableId: string, playerId: string) => {
    const nextTables = { ...session.tables, [tableId]: (session.tables[tableId] || []).filter((id) => id !== playerId) }
    const nextSideline = session.sideline.includes(playerId) ? session.sideline : [...session.sideline, playerId]
    await persistSession({ ...session, tables: nextTables, sideline: nextSideline })
    play('tile')
  }

  const toggleTable = (tableId: string) => {
    setCollapsedTables((current) => ({ ...current, [tableId]: !current[tableId] }))
  }

  const toggleSideline = () => {
    setSidelineCollapsed((current) => !current)
  }

  const openPicker = (tableId: string) => {
    setPickerTableId(tableId)
    setPickerSearch('')
  }

  const closePicker = () => {
    setPickerTableId(null)
    setPickerSearch('')
  }

  const pickPlayer = async (playerId: string) => {
    if (!pickerTableId) return
    const playersOnTable = session.tables[pickerTableId] || []
    if (playersOnTable.length >= 4) {
      play('error')
      showToast('Table is full.')
      return
    }
    if (playersOnTable.includes(playerId)) return

    const nextTables = { ...session.tables, [pickerTableId]: [...playersOnTable, playerId] }
    const nextSideline = session.sideline.filter((id) => id !== playerId)
    await persistSession({ ...session, tables: nextTables, sideline: nextSideline })
    play('tile')

    if (nextTables[pickerTableId].length >= 4) {
      closePicker()
    }
  }

  const openSwapPicker = (tableId: string, playerId: string) => {
    setSwapPickerTableId(tableId)
    setSwapPickerPlayer(playerId)
    setSwapPickerSearch('')
  }

  const closeSwapPicker = () => {
    setSwapPickerTableId(null)
    setSwapPickerPlayer(null)
    setSwapPickerSearch('')
  }

  const doSwap = async (targetPlayerId: string) => {
    if (!swapPickerTableId || !swapPickerPlayer) return
    const sourceTable = swapPickerTableId
    const sourcePlayer = swapPickerPlayer
    const targetTable = Object.entries(session.tables).find(([, playersOnTable]) => playersOnTable.includes(targetPlayerId))?.[0] ?? null
    const targetOnSideline = session.sideline.includes(targetPlayerId)

    const nextTables = { ...session.tables }
    nextTables[sourceTable] = nextTables[sourceTable].filter((id) => id !== sourcePlayer)

    if (targetTable) {
      nextTables[targetTable] = nextTables[targetTable].filter((id) => id !== targetPlayerId)
      nextTables[targetTable].push(sourcePlayer)
    }

    if (targetOnSideline) {
      const nextSideline = session.sideline.filter((id) => id !== targetPlayerId)
      const nextSidelineWithSource = [...nextSideline, sourcePlayer]
      nextTables[sourceTable] = [...nextTables[sourceTable], targetPlayerId]
      await persistSession({ ...session, tables: nextTables, sideline: nextSidelineWithSource })
      play('tile')
      closeSwapPicker()
      return
    }

    nextTables[sourceTable] = [...nextTables[sourceTable], targetPlayerId]
    await persistSession({ ...session, tables: nextTables, sideline: session.sideline })
    play('tile')
    closeSwapPicker()
  }

  const setupPlayers = useMemo(() => {
    const query = setupSearch.toLowerCase().trim()
    return players
      .slice()
      .sort((a, b) => a.displayName.localeCompare(b.displayName))
      .filter((player) => player.displayName.toLowerCase().includes(query))
  }, [players, setupSearch])

  const pickerPlayers = useMemo(() => {
    const query = pickerSearch.toLowerCase().trim()
    return session.sideline
      .filter((playerId) => playerInfo(playerId).displayName.toLowerCase().includes(query))
      .map((playerId) => playerInfo(playerId))
  }, [pickerSearch, playerInfo, session.sideline])

  const swapPickerPlayers = useMemo(() => {
    const query = swapPickerSearch.toLowerCase().trim()
    return session.participants
      .filter((playerId) => playerId !== swapPickerPlayer)
      .filter((playerId) => playerInfo(playerId).displayName.toLowerCase().includes(query))
      .map((playerId) => playerInfo(playerId))
  }, [playerInfo, session.participants, swapPickerPlayer, swapPickerSearch])

  const renderWinPanel = (tableId: string) => {
    const playersOnTable = session.tables[tableId] || []
    const winnerChips = playersOnTable.map((playerId) => {
      const info = playerInfo(playerId)
      const selected = winState.winner === playerId
      return (
        <button
          key={playerId}
          type="button"
          className={`loser-chip winner-choice${selected ? ' selected winner-selected' : ''}`}
          onClick={() => setWinner(tableId, playerId)}
        >
          {info.icon ?? '👤'} {shortName(info.displayName)}
        </button>
      )
    })

    const others = playersOnTable.filter((playerId) => playerId !== winState.winner)
    const loserChips = others.map((playerId) => {
      const info = playerInfo(playerId)
      const selected = winState.loser === playerId
      return (
        <button
          key={playerId}
          type="button"
          className={`loser-chip discard-choice${selected ? ' selected discard-selected' : ''}`}
          onClick={() => setLoser(tableId, playerId)}
        >
          {info.icon ?? '👤'} {shortName(info.displayName)}
        </button>
      )
    })

    const fanChips = [3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13].map((fanValue) => {
      const selected = winState.fan === fanValue
      return (
        <button
          key={fanValue}
          type="button"
          className={`fan-chip${selected ? ' selected' : ''}`}
          onClick={() => setFan(tableId, fanValue)}
        >
          {fanValue}
          {fanValue === 13 ? '+ 🔥' : ''}
        </button>
      )
    })

    const preview = calcScores()
    const previewRows = preview
      ? Object.entries(preview).map(([playerId, score]) => {
          const info = playerInfo(playerId)
          const cls = score > 0 ? 'pos' : score < 0 ? 'neg' : 'score-zero'
          return (
            <div key={playerId} className="score-preview-item">
              <div className="score-preview-name">{info.icon ?? '👤'} {shortName(info.displayName)}</div>
              <div className={`score-preview-val ${cls}`}>{score > 0 ? `+${score}` : score}</div>
            </div>
          )
        })
      : []

    const canSubmit = Boolean(preview)
    const selfSelected = winState.winType === 'self'
    const discardSelected = winState.winType === 'discard'

    return (
      <>
        <div className="win-panel-title">👑 Select Winner</div>
        <div className="loser-row visible" style={{ marginBottom: 8 }}>
          <div className="loser-label">Who won?</div>
          <div className="loser-chips">{winnerChips}</div>
        </div>

        {winState.winner ? (
          <>
            <div className="win-type-row">
              <button
                type="button"
                className={`win-type-btn${selfSelected ? ' selected' : ''}`}
                onClick={() => setWinType(tableId, 'self')}
              >
                🀄 Self-draw<br />
                <small style={{ fontWeight: 400, fontSize: 9 }}>自摸</small>
              </button>
              <button
                type="button"
                className={`win-type-btn${discardSelected ? ' selected' : ''}`}
                onClick={() => setWinType(tableId, 'discard')}
              >
                🎴 Discard win
              </button>
            </div>

            {discardSelected ? (
              <div className="loser-row visible">
                <div className="loser-label">Who discarded?</div>
                <div className="loser-chips">{loserChips}</div>
              </div>
            ) : null}

            {winState.winType ? (
              <div className="fan-row">
                <div className="fan-label">
                  <span>Fan (3–13)</span>
                  {winState.fan ? <span style={{ color: 'var(--purple)', fontWeight: 700 }}>{FAN_POINTS[winState.fan] ?? 384} pts base</span> : null}
                </div>
                <div className="fan-chips">{fanChips}</div>
              </div>
            ) : null}

            <div className={`score-preview ${preview ? 'visible' : ''}`}>
              <div className="score-preview-grid">{previewRows}</div>
            </div>
          </>
        ) : null}

        <div className="win-panel-actions">
          <button type="button" className="btn-cancel-win" onClick={closeAllWinPanels}>✕ Cancel</button>
          <button
            type="button"
            className="btn-submit-game"
            onClick={() => submitWin(tableId)}
            disabled={!canSubmit || savingGameTable === tableId}
          >
            {savingGameTable === tableId ? 'Saving...' : 'Save Result'}
          </button>
        </div>
      </>
    )
  }

  const handleDragStart = (event: React.DragEvent<HTMLDivElement>, playerId: string, source: string) => {
    dragPlayerRef.current = playerId
    dragSourceRef.current = source
    const chip = event.currentTarget.closest('.player-chip')
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', playerId)
    setTimeout(() => {
      chip?.classList.add('dragging')
    }, 0)
    closeAllWinPanels()
  }

  const handleDragEnd = () => {
    document.querySelectorAll('.player-chip.dragging').forEach((el) => el.classList.remove('dragging'))
    document.querySelectorAll('.drag-over').forEach((el) => el.classList.remove('drag-over'))
  }

  const handleDragOver = (event: React.DragEvent<HTMLElement>, zone: 'sideline' | 'table') => {
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    const target = event.currentTarget
    if (zone === 'sideline') {
      document.getElementById('sidelineArea')?.classList.add('drag-over')
    } else {
      target.classList.add('drag-over')
    }
  }

  const handleDragLeave = (event: React.DragEvent<HTMLElement>, zone: 'sideline' | 'table') => {
    event.currentTarget.classList.remove('drag-over')
    if (zone === 'sideline') {
      document.getElementById('sidelineArea')?.classList.remove('drag-over')
    }
  }

  const handleDrop = async (event: React.DragEvent<HTMLElement>, zone: 'sideline' | 'table', tableId: string | null) => {
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.classList.remove('drag-over')
    document.getElementById('sidelineArea')?.classList.remove('drag-over')

    const playerId = dragPlayerRef.current
    const source = dragSourceRef.current
    dragPlayerRef.current = null
    dragSourceRef.current = null
    if (!playerId) return

    if (zone === 'sideline') {
      if (source === 'sideline') return
      if (source) {
        const nextTables = { ...session.tables }
        nextTables[source] = (nextTables[source] || []).filter((id) => id !== playerId)
        const nextSideline = session.sideline.includes(playerId) ? session.sideline : [...session.sideline, playerId]
        await persistSession({ ...session, tables: nextTables, sideline: nextSideline })
      }
      return
    }

    if (!tableId) return
    const targetPlayers = session.tables[tableId] || []
    if (targetPlayers.includes(playerId)) return

    const targetChip = (event.target as HTMLElement).closest('.player-chip') as HTMLElement | null
    const targetPlayerId = targetChip?.dataset.player ?? null

    const nextTables = { ...session.tables }
    let nextSideline = session.sideline

    if (targetPlayerId && targetPlayerId !== playerId) {
      if (source === 'sideline') {
        nextSideline = session.sideline.filter((id) => id !== playerId)
        if (!nextSideline.includes(targetPlayerId)) {
          nextSideline = [...nextSideline, targetPlayerId]
        }
      } else if (source && source !== tableId) {
        nextTables[source] = (nextTables[source] || []).filter((id) => id !== playerId)
        if (!nextTables[source].includes(targetPlayerId)) {
          nextTables[source].push(targetPlayerId)
        }
      } else {
        const sourceIdx = targetPlayers.indexOf(targetPlayerId)
        const playerIdx = targetPlayers.indexOf(playerId)
        if (playerIdx !== -1) nextTables[tableId][playerIdx] = targetPlayerId
        if (sourceIdx !== -1) nextTables[tableId][sourceIdx] = playerId
        await persistSession({ ...session, tables: nextTables, sideline: nextSideline })
        play('tile')
        return
      }

      const idx = targetPlayers.indexOf(targetPlayerId)
      if (idx !== -1) {
        nextTables[tableId] = [...targetPlayers]
        nextTables[tableId][idx] = playerId
      } else {
        nextTables[tableId] = [...targetPlayers, playerId]
      }
    } else {
      if (targetPlayers.length >= 4) {
        play('error')
        showToast('Table is full (4/4)')
        return
      }
      if (source === 'sideline') {
        nextSideline = session.sideline.filter((id) => id !== playerId)
      } else if (source && source !== tableId) {
        nextTables[source] = (nextTables[source] || []).filter((id) => id !== playerId)
      }
      nextTables[tableId] = [...(nextTables[tableId] || []), playerId]
    }

    await persistSession({ ...session, tables: nextTables, sideline: nextSideline })
    play('tile')
  }

  const pickerAvailable = useMemo(() => {
    const query = pickerSearch.toLowerCase().trim()
    return session.sideline.filter((playerId) => playerInfo(playerId).displayName.toLowerCase().includes(query))
  }, [pickerSearch, playerInfo, session.sideline])

  const swapPickerAvailable = useMemo(() => {
    const query = swapPickerSearch.toLowerCase().trim()
    return session.participants
      .filter((playerId) => playerId !== swapPickerPlayer)
      .filter((playerId) => playerInfo(playerId).displayName.toLowerCase().includes(query))
  }, [playerInfo, session.participants, swapPickerPlayer, swapPickerSearch])

  const renderSessionTables = () => {
    return sessionTables.map((playersOnTable, index) => {
      const tableId = String(index + 1)
      const isValid = playersOnTable.length === 4
      const tableName = `Table ${tableId}`
      const visible = filteredTableCards.find((item) => item.tableId === tableId)?.visible ?? true
      if (!visible) return null

      return (
        <div key={tableId} className={`table-card${isValid ? ' valid' : ''}`} id={`table-${tableId}`}>
          {playersOnTable.length > 0 ? (
            <button className="clear-table-btn" type="button" onClick={() => clearSingleTable(tableId)}>✕</button>
          ) : null}
          <div className="table-header">
            <span className="table-name" onClick={() => toggleTable(tableId)} style={{ cursor: 'pointer', userSelect: 'none', flex: 1 }}>
              🀄 {tableName}
            </span>
            <span className={`table-status ${isValid ? 'valid' : 'waiting'}`}>
              {isValid ? '✓ Ready' : `${playersOnTable.length}/4`}
            </span>
            <span id={`tableChevron-${tableId}`} onClick={() => toggleTable(tableId)} style={{ fontSize: 10, color: 'var(--gray)', marginLeft: 4, cursor: 'pointer' }}>
              {collapsedTables[tableId] ? '▼' : '▲'}
            </span>
          </div>
          <div id={`tableBody-${tableId}`} style={{ display: collapsedTables[tableId] ? 'none' : undefined }}>
            <div
              className="table-seats"
              id={`seats-${tableId}`}
              onDragOver={(event) => handleDragOver(event, 'table')}
              onDragLeave={(event) => handleDragLeave(event, 'table')}
              onDrop={(event) => handleDrop(event, 'table', tableId)}
            >
              {Array.from({ length: 4 }).map((_, seatIndex) => {
                const playerId = playersOnTable[seatIndex]
                if (playerId) {
                  const info = playerInfo(playerId)
                  return (
                    <div key={seatIndex} className="seat-slot occupied" id={`seat-${tableId}-${seatIndex}`}>
                      <div
                        className="player-chip"
                        draggable
                        data-player={playerId}
                        data-source={tableId}
                        onDragStart={(event) => handleDragStart(event, playerId, tableId)}
                        onDragEnd={handleDragEnd}
                      >
                        <button className="chip-remove-btn" type="button" onClick={() => removeToSideline(tableId, playerId)} title="Remove">
                          ×
                        </button>
                        <div className="chip-icon">{info.icon ?? '👤'}</div>
                        <div className="chip-name" title={info.displayName}>{shortName(info.displayName)}</div>
                        <button className="chip-win-btn" type="button" onClick={() => setWinner(tableId, playerId)} title="Won!">
                          👑
                        </button>
                        <button className="chip-swap-btn" type="button" onClick={() => openSwapPicker(tableId, playerId)} title="Swap">
                          ⇄
                        </button>
                      </div>
                    </div>
                  )
                }

                return (
                  <div
                    key={seatIndex}
                    className="seat-slot"
                    id={`seat-${tableId}-${seatIndex}`}
                    onDragOver={(event) => handleDragOver(event, 'table')}
                    onDragLeave={(event) => handleDragLeave(event, 'table')}
                    onDrop={(event) => handleDrop(event, 'table', tableId)}
                    onClick={() => openPicker(tableId)}
                    style={{ cursor: 'pointer' }}
                  >
                    <span className="empty-seat-hint">+ Add</span>
                  </div>
                )
              })}
            </div>
            <div className="table-actions" id={`actions-${tableId}`}>
              <button className="btn-draw" type="button" onClick={() => addDraw(tableId)} disabled={savingGameTable === tableId}>
                {savingGameTable === tableId ? '⏳ Saving...' : '🤝 Draw (0 pts)'}
              </button>
              <button className="btn-draw" type="button" onClick={() => openWinPanel(tableId)} style={{ background: '#ebf4ff', color: '#3182ce' }}>
                👑 Winner...
              </button>
            </div>
            {winState.tableId === tableId && typeof document !== 'undefined'
              ? createPortal(<div className="win-panel active session-result-dialog" id={`winPanel-${tableId}`}>{renderWinPanel(tableId)}</div>, document.body)
              : <div className="win-panel" id={`winPanel-${tableId}`} />}
          </div>
        </div>
      )
    })
  }

  const sessionPlayersCount = session.participants.length
  const sessionTableCount = session.tableCount

  return (
    <div className="session-manager">
      <style jsx global>{`

        :root {
          --purple: #667eea;
          --purple-dark: #5568d3;
          --green: #48bb78;
          --green-dark: #38a169;
          --red: #fc8181;
          --red-dark: #e53e3e;
          --gold: #f6ad55;
          --gray: #718096;
          --border: #e2e8f0;
          --white: #ffffff;
          --card-bg: #ffffff;
          --radius: 10px;
        }

        .header {
          background: #ffffff;
          color: #0f172a;
          padding: 12px 14px 10px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          position: sticky;
          top: 0;
          z-index: 100;
          border: 1px solid #e2e8f0;
          border-radius: 10px 10px 0 0;
          box-shadow: 0 1px 3px rgba(15,23,42,0.08);
        }
        .header h1 { font-size: 15px; font-weight: 800; letter-spacing: 0.3px; }
        .header-sub { font-size: 10px; color: #64748b; margin-top: 1px; }
        .header-actions { display: flex; gap: 6px; }
        .btn-icon {
          background: #f8fafc;
          border: 1px solid #cbd5e1; border-radius: 6px;
          color: #334155; padding: 5px 8px;
          font-size: 11px; font-weight: 600;
          cursor: pointer; transition: background 0.15s;
          white-space: nowrap;
        }
        .btn-icon:hover { background: #eef2ff; border-color: #a5b4fc; color: #3730a3; }
        .btn-icon.danger { background: #fff1f2; border-color: #fecdd3; color: #be123c; }
        .btn-icon.danger:hover { background: #ffe4e6; }

        .page { display: none; padding: 12px; }
        .page.active { display: block; }

        .setup-card {
          background: var(--card-bg);
          border-radius: var(--radius);
          border: 1px solid var(--border);
          padding: 14px;
          margin-bottom: 12px;
        }
        .setup-card h3 {
          font-size: 11px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.6px;
          color: var(--gray); margin-bottom: 10px;
        }
        .table-count-row {
          display: flex; gap: 8px;
        }
        .table-count-btn {
          flex: 1; padding: 10px 6px;
          border: 2px solid var(--border);
          border-radius: 8px; background: white;
          font-size: 18px; cursor: pointer;
          transition: all 0.15s; text-align: center;
        }
        .table-count-btn.selected {
          border-color: var(--purple);
          background: #ebf4ff;
        }
        .table-count-btn span { display: block; font-size: 10px; font-weight: 600; color: var(--gray); margin-top: 2px; }
        .desktop-table-count { display: flex; align-items: center; gap: 10px; }
        .mobile-table-stepper { display: none; }
        .table-stepper-button {
          width: 46px;
          min-height: 46px;
          border: 1px solid rgb(var(--line));
          border-radius: 3px;
          background: rgb(var(--surface-2));
          color: rgb(var(--ink));
          font-size: 24px;
          font-weight: 800;
          line-height: 1;
          cursor: pointer;
          touch-action: manipulation;
        }
        .table-stepper-button:active:not(:disabled) { transform: translateY(1px); background: rgb(var(--bamboo)/.14); }
        .table-stepper-button:disabled { cursor: not-allowed; opacity: .35; }
        .table-stepper-value {
          min-width: 74px;
          min-height: 46px;
          display: grid;
          place-items: center;
          border: 1px solid rgb(var(--bamboo));
          border-radius: 3px;
          background: rgb(var(--bamboo)/.08);
          color: rgb(var(--ink));
          font-size: 22px;
          font-weight: 800;
          font-variant-numeric: tabular-nums;
        }

        .player-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 6px;
          max-height: 340px;
          overflow-y: auto;
        }
        .player-toggle {
          border: 2px solid var(--border);
          border-radius: 8px;
          padding: 7px 4px;
          cursor: pointer;
          text-align: center;
          transition: all 0.15s;
          background: white;
        }
        .player-toggle .icon { font-size: 20px; display: block; }
        .player-toggle .name { font-size: 10px; font-weight: 600; color: #4a5568; margin-top: 3px; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .player-toggle.selected {
          border-color: var(--purple);
          background: #ebf4ff;
        }
        .player-toggle.selected .name { color: var(--purple-dark); }

        .setup-footer {
          display: flex; gap: 8px; align-items: center;
        }
        .selected-count {
          font-size: 12px; color: var(--gray); font-weight: 600; flex: 1;
        }
        .btn-primary {
          background: var(--purple); color: white;
          border: none; border-radius: 8px;
          padding: 10px 18px; font-size: 13px;
          font-weight: 700; cursor: pointer;
          transition: background 0.15s;
        }
        .btn-primary:hover:not(:disabled) { background: var(--purple-dark); }
        .btn-primary:disabled { background: #cbd5e0; cursor: not-allowed; }
        .btn-secondary {
          background: #e2e8f0; color: #4a5568;
          border: none; border-radius: 8px;
          padding: 10px 14px; font-size: 12px;
          font-weight: 700; cursor: pointer;
        }
        .btn-secondary:hover { background: #cbd5e0; }

        #sessionPage {
          display: none;
          flex-direction: column;
          height: calc(100vh - 48px);
          padding: 0;
          overflow: hidden;
        }
        #sessionPage.active {
          display: flex;
        }
        .tables-scroll {
          flex: 1;
          overflow-y: auto;
          padding: 12px 12px 0;
          order: 2;
        }
        .sideline-section {
          flex-shrink: 0;
          padding: 10px;
          border-bottom: 2px solid var(--border);
          border-top: none;
          background: var(--white);
          border-radius: 0;
          order: 1;
        }

        .section-label {
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.6px;
          color: var(--gray); margin-bottom: 8px;
          display: flex; align-items: center; gap: 6px;
        }
        .section-label .badge {
          background: var(--purple);
          color: white; border-radius: 8px;
          padding: 1px 6px; font-size: 9px;
        }

        .tables-container { margin-bottom: 10px; }

        .table-card {
          background: var(--card-bg);
          border: 2px solid var(--border);
          border-radius: var(--radius);
          margin-bottom: 14px;
          transition: border-color 0.2s, box-shadow 0.2s;
          overflow: visible;
          position: relative;
        }
        .table-card.valid {
          border-color: var(--green);
          box-shadow: 0 0 0 1px rgba(72,187,120,0.2);
        }
        .table-card.drag-over {
          border-color: var(--purple);
          box-shadow: 0 0 0 3px rgba(102,126,234,0.2);
          background: #f0f4ff;
        }

        .table-header {
          display: flex; align-items: center;
          padding: 8px 10px 6px;
          border-bottom: 1px solid #f0f0f0;
        }
        .table-name {
          font-size: 12px; font-weight: 700;
          color: #0f172a; flex: 1;
        }
        .table-status {
          font-size: 10px; font-weight: 600;
          padding: 2px 7px; border-radius: 8px;
        }
        .table-status.valid { background: #c6f6d5; color: #276749; }
        .table-status.waiting { background: #e2e8f0; color: var(--gray); }

        .table-seats {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
          padding: 6px 8px;
          min-height: 64px;
        }

        .seat-slot {
          border: 1.5px dashed #cbd5e0;
          border-radius: 7px;
          min-height: 54px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s;
          position: relative;
        }
        .seat-slot.occupied { border-style: solid; border-color: transparent; background: transparent; }
        .seat-slot.drag-target {
          border-color: var(--purple);
          background: #f0f4ff;
        }
        .empty-seat-hint { font-size: 10px; color: #cbd5e0; font-weight: 600; }

        .table-actions {
          padding: 6px 8px 8px;
          display: none;
          gap: 5px;
          flex-wrap: wrap;
        }
        .table-card.valid .table-actions { display: flex; }

        .btn-draw {
          flex: 1;
          background: #e2e8f0; color: #1e293b;
          border: none; border-radius: 6px;
          padding: 7px 8px; font-size: 11px;
          font-weight: 700; cursor: pointer;
          transition: all 0.15s;
          min-width: 60px;
        }
        .btn-draw:hover { background: #bee3f8; color: #2b6cb0; }
        .btn-draw:disabled {
          background: #cbd5e1;
          color: #334155;
          cursor: not-allowed;
          opacity: 1;
        }

        .win-panel {
          padding: 8px;
          background: #fff7ed;
          border-top: 1px solid #fed7aa;
          color: #1f2937;
          display: none;
        }
        .win-panel.active { display: block; }
        .win-panel-title {
          font-size: 10px; font-weight: 700;
          text-transform: uppercase; letter-spacing: 0.5px;
          color: #9a3412; margin-bottom: 6px;
        }
        .win-type-row {
          display: flex; gap: 5px; margin-bottom: 8px;
        }
        .win-type-btn {
          flex: 1; padding: 6px 4px;
          border: 2px solid #cbd5e1;
          border-radius: 6px; background: white;
          color: #1e293b;
          font-size: 11px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
          text-align: center;
        }
        .win-type-btn:disabled {
          background: #f1f5f9;
          border-color: #cbd5e1;
          color: #64748b;
          cursor: not-allowed;
          opacity: 1;
        }
        .win-type-btn.selected { border-color: #f97316; background: #ffedd5; color: #9a3412; }

        .loser-row {
          margin-bottom: 8px; display: none;
        }
        .loser-row.visible { display: block; }
        .loser-label { font-size: 10px; font-weight: 700; color: #334155; margin-bottom: 4px; }
        .loser-chips { display: flex; gap: 4px; flex-wrap: wrap; }
        .loser-chip {
          padding: 4px 8px;
          border: 1.5px solid #cbd5e1;
          border-radius: 12px; background: white;
          color: #1e293b;
          font-size: 11px; font-weight: 600;
          cursor: pointer; transition: all 0.15s;
        }
        .loser-chip:disabled {
          background: #f8fafc;
          color: #64748b;
          cursor: not-allowed;
          opacity: 1;
        }
        .loser-chip.selected { border-color: var(--red); background: #fff5f5; color: var(--red-dark); }

        .fan-row { margin-bottom: 8px; }
        .fan-label { font-size: 10px; font-weight: 700; color: #334155; margin-bottom: 4px; display: flex; justify-content: space-between; }
        .fan-chips { display: flex; gap: 3px; flex-wrap: wrap; }
        .fan-chip {
          padding: 4px 7px;
          border: 1.5px solid #cbd5e1;
          border-radius: 8px; background: white;
          font-size: 11px; font-weight: 700;
          cursor: pointer; transition: all 0.15s;
          color: #1e293b;
        }
        .fan-chip.selected { border-color: var(--purple); background: #ebf4ff; color: var(--purple-dark); }

        .score-preview {
          background: linear-gradient(135deg, #667eea, #764ba2);
          border-radius: 8px;
          padding: 8px;
          margin-bottom: 8px;
          display: none;
        }
        .score-preview.visible { display: block; }
        .score-preview-grid {
          display: grid; grid-template-columns: 1fr 1fr;
          gap: 4px;
        }
        .score-preview-item {
          background: rgba(255,255,255,0.15);
          border-radius: 5px; padding: 4px 6px;
        }
        .score-preview-name { font-size: 10px; color: rgba(255,255,255,0.8); }
        .score-preview-val { font-size: 13px; font-weight: 800; }
        .score-preview-val.pos { color: #68d391; }
        .score-preview-val.neg { color: #fc8181; }
        .score-preview-val.score-zero { color: rgba(255,255,255,0.5); }

        .win-panel-actions { display: flex; gap: 5px; }
        .btn-submit-game {
          flex: 1; background: var(--purple); color: white;
          border: none; border-radius: 6px;
          padding: 8px; font-size: 12px;
          font-weight: 700; cursor: pointer;
          transition: all 0.15s;
        }
        .btn-submit-game:hover:not(:disabled) { background: var(--purple-dark); }
        .btn-submit-game:disabled { background: #cbd5e0; cursor: not-allowed; }
        .btn-cancel-win {
          background: #e2e8f0; color: #4a5568;
          border: none; border-radius: 6px;
          padding: 8px 10px; font-size: 12px;
          font-weight: 700; cursor: pointer;
        }
        .btn-cancel-win:hover { background: #cbd5e0; }

        .score-flash {
          position: fixed; top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(72,187,120,0.92);
          display: flex; flex-direction: column;
          align-items: center; justify-content: center;
          z-index: 999; color: white;
          animation: flashIn 0.2s ease;
          pointer-events: none;
        }
        @keyframes flashIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .flash-title { font-size: 22px; font-weight: 800; margin-bottom: 8px; }
        .flash-scores { display: flex; flex-direction: column; gap: 4px; width: 80%; }
        .flash-row { display: flex; justify-content: space-between; align-items: center; background: rgba(255,255,255,0.2); border-radius: 6px; padding: 5px 10px; font-weight: 700; font-size: 14px; }
        .flash-score-val.pos { color: #68d391; }
        .flash-score-val.neg { color: #fc8181; }

        .sideline-section {
          background: var(--card-bg);
          border-radius: var(--radius);
          border: 1px solid var(--border);
          padding: 10px;
        }
        .sideline-area {
          display: flex;
          flex-wrap: wrap;
          gap: 6px;
          min-height: 50px;
          padding: 6px;
          border: 2px dashed #e2e8f0;
          border-radius: 8px;
          transition: all 0.15s;
          max-height: 160px;
          overflow-y: auto;
        }
        .sideline-area.drag-over {
          border-color: var(--purple);
          background: #f0f4ff;
        }
        .sideline-empty {
          font-size: 11px; color: #cbd5e0;
          font-weight: 600; padding: 8px; width: 100%;
          text-align: center;
        }

        .player-chip {
          display: flex; flex-direction: column;
          align-items: center;
          width: 52px;
          cursor: grab;
          user-select: none;
          transition: transform 0.1s, opacity 0.1s;
          position: relative;
        }
        .player-chip:active { cursor: grabbing; }
        .player-chip.dragging {
          opacity: 0.4; transform: scale(0.9);
        }
        .player-chip.winner-candidate {
          outline: 2px solid var(--gold);
          outline-offset: 2px;
          border-radius: 6px;
        }

        .chip-icon {
          width: 40px; height: 40px;
          background: linear-gradient(135deg, #ebf4ff, #e9d8fd);
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 22px;
          border: 2px solid var(--border);
          transition: border-color 0.15s;
        }
        .player-chip:hover .chip-icon { border-color: var(--purple); }
        .chip-name {
          font-size: 9px; font-weight: 700;
          text-align: center; color: #0f172a;
          margin-top: 3px;
          max-width: 52px;
          overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
        }

        .seat-slot .player-chip { width: 100%; padding: 4px 2px; }
        .seat-slot .chip-icon { width: 32px; height: 32px; font-size: 16px; }
        .seat-slot .chip-name { font-size: 9px; }

        .toast {
          position: fixed; bottom: 16px; left: 50%; transform: translateX(-50%);
          background: #2d3748; color: white;
          border-radius: 20px; padding: 8px 16px;
          font-size: 12px; font-weight: 600;
          z-index: 1000; display: none;
          animation: toastIn 0.2s ease;
        }
        .toast.active {
          display: block;
        }
        @keyframes toastIn { from { opacity: 0; transform: translateX(-50%) translateY(8px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }

        .loading-screen {
          display: flex; flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 200px; color: var(--gray);
        }
        .spinner {
          width: 32px; height: 32px;
          border: 3px solid var(--border);
          border-top-color: var(--purple);
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          margin-bottom: 10px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .divider { height: 1px; background: var(--border); margin: 10px 0; }
        .error-msg { background: #fff5f5; color: #c53030; border-radius: 6px; padding: 8px 10px; font-size: 11px; margin-top: 6px; display: none; }

        .menu-item {
          display: block; width: 100%;
          padding: 10px 14px; border: none;
          background: white; text-align: left;
          font-size: 13px; font-weight: 600;
          cursor: pointer; color: #2d3748;
          border-bottom: 1px solid #f0f0f0;
        }
        .menu-item:last-child { border-bottom: none; }
        .menu-item:hover { background: #f7fafc; }
        .danger-item { color: #e53e3e; }
        .danger-item:hover { background: #fff5f5; }

        .info-section {
          display: flex;
          gap: 12px;
          align-items: flex-start;
        }
        .info-icon {
          font-size: 20px;
          width: 32px;
          height: 32px;
          background: #ebf4ff;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .info-title {
          font-size: 13px;
          font-weight: 700;
          color: #2d3748;
          margin-bottom: 3px;
        }
        .info-body {
          font-size: 12px;
          color: #718096;
          line-height: 1.5;
        }

        .chip-remove-btn {
          position: absolute; top: -3px; left: -3px;
          width: 14px; height: 14px;
          background: rgba(0,0,0,0.25);
          border-radius: 50%;
          border: none; cursor: pointer;
          font-size: 10px;
          display: none;
          align-items: center; justify-content: center;
          font-weight: 700; color: white;
          z-index: 10;
          line-height: 1;
          opacity: 0;
          transition: opacity 0.15s, background 0.15s;
        }
        .chip-win-btn {
          position: absolute; top: -4px; right: -4px;
          width: 16px; height: 16px;
          background: var(--gold);
          border-radius: 50%;
          border: none; cursor: pointer;
          font-size: 9px; display: none;
          align-items: center; justify-content: center;
          font-weight: 700; color: white;
          z-index: 10;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .player-chip .chip-remove-btn { display: flex; }
        .table-card.valid .player-chip .chip-win-btn { display: flex; }
        .player-chip:hover .chip-remove-btn { opacity: 1; }
        .table-card.valid .player-chip:hover .chip-win-btn { opacity: 1; }
        .chip-remove-btn:hover { background: rgba(0,0,0,0.5) !important; }

        .chip-swap-btn {
          position: absolute; bottom: -4px; right: -4px;
          width: 16px; height: 16px;
          background: #667eea;
          border-radius: 50%;
          border: none; cursor: pointer;
          font-size: 9px; display: none;
          align-items: center; justify-content: center;
          font-weight: 700; color: white;
          z-index: 10;
          opacity: 0;
          transition: opacity 0.15s;
        }
        .table-card.valid .player-chip .chip-swap-btn { display: flex; }
        .table-card.valid .player-chip:hover .chip-swap-btn { opacity: 1; }

        .clear-table-btn {
          position: absolute;
          top: -10px;
          left: -10px;
          width: 22px;
          height: 22px;
          border: none;
          border-radius: 50%;
          background: #e2e8f0;
          color: #718096;
          font-size: 12px;
          font-weight: 800;
          line-height: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          z-index: 100;
          opacity: 0;
          transition:
            opacity 0.15s,
            background 0.15s,
            transform 0.15s;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
        }
        .table-card:hover .clear-table-btn {
          opacity: 1;
        }
        .clear-table-btn:hover {
          background: #fed7d7;
          color: #c53030;
          transform: scale(1.08);
        }
        /* Clubhouse session system */
        .session-manager { --purple:rgb(var(--bamboo)); --purple-dark:rgb(var(--bamboo-bright)); --green:rgb(var(--bamboo)); --green-dark:rgb(var(--bamboo-bright)); --red:rgb(var(--cinnabar)); --red-dark:rgb(var(--cinnabar)); --gold:rgb(var(--gold)); --gray:rgb(var(--muted)); --border:rgb(var(--line)); --white:rgb(var(--surface)); --card-bg:rgb(var(--surface)); --radius:4px; color:rgb(var(--ink)); font-family:var(--font-sans),sans-serif; overflow:hidden; border:1px solid rgb(var(--line)); border-radius:4px; background:rgb(var(--canvas)/.58); box-shadow:5px 6px 0 rgb(var(--shadow)/.07); }
        .session-manager .header { position:relative; top:auto; padding:16px 18px; border:0; border-bottom:3px double rgb(var(--line)); border-radius:0; background:rgb(var(--surface)); box-shadow:none; }
        .session-manager .header>div:first-child>div:first-child { font-family:var(--font-sans),sans-serif; font-size:22px!important; letter-spacing:-.02em; }
        .session-manager .header-sub { margin-top:4px; color:rgb(var(--muted)); font-size:10px; letter-spacing:.08em; text-transform:uppercase; }
        .session-manager .btn-icon { min-width:38px; min-height:38px; border:1px solid rgb(var(--line)); border-radius:3px; background:rgb(var(--surface-2)); color:rgb(var(--ink)); box-shadow:2px 2px 0 rgb(var(--shadow)/.07); }
        .session-manager .btn-icon:hover { border-color:rgb(var(--cinnabar)); background:rgb(var(--cinnabar)/.06); color:rgb(var(--cinnabar)); }
        .session-manager #sessionPage { height:min(720px,calc(100vh - 128px)); background:transparent; }
        .session-manager .tables-scroll { padding:14px; background:transparent; }
        .session-manager input[type=text],.session-manager input[type=number] { border:1px solid rgb(var(--line))!important; border-radius:3px!important; background:rgb(var(--surface))!important; color:rgb(var(--ink))!important; box-shadow:inset 3px 0 0 rgb(var(--bamboo)); outline:none; }
        .session-manager input:focus { border-color:rgb(var(--bamboo))!important; box-shadow:inset 3px 0 0 rgb(var(--cinnabar)),0 0 0 2px rgb(var(--bamboo)/.12); }
        .session-manager .sideline-section { order:1; margin:12px 12px 0; padding:12px; border:1px solid rgb(var(--line)); border-left:4px solid rgb(var(--gold)); border-radius:3px; background:rgb(var(--surface-2)); box-shadow:none; }
        .session-manager .section-label { margin:0 0 10px; color:rgb(var(--ink)); font-size:10px; letter-spacing:.16em; }
        .session-manager .section-label .badge { border-radius:2px; padding:2px 7px; background:rgb(var(--cinnabar)); }
        .session-manager .sideline-area { min-height:74px; padding:10px; gap:12px; border:1px dashed rgb(var(--line)); border-radius:2px; background:rgb(var(--surface)); }
        .session-manager .table-card { border:1px solid rgb(var(--line)); border-left:4px solid rgb(var(--muted)); border-radius:3px; background:rgb(var(--surface)); box-shadow:4px 4px 0 rgb(var(--shadow)/.06); overflow:visible; }
        .session-manager .table-card.valid { border-color:rgb(var(--line)); border-left-color:rgb(var(--bamboo)); box-shadow:4px 4px 0 rgb(var(--bamboo)/.12); }
        .session-manager .table-card.drag-over { border-color:rgb(var(--cinnabar)); background:rgb(var(--cinnabar)/.04); }
        .session-manager .table-header { min-height:46px; padding:10px 12px; border-bottom:1px solid rgb(var(--line)); background:rgb(var(--surface-2)); }
        .session-manager .table-name { font-family:var(--font-sans),sans-serif; font-size:17px; color:rgb(var(--ink)); }
        .session-manager .table-status { border-radius:2px; padding:4px 8px; text-transform:uppercase; letter-spacing:.08em; }
        .session-manager .table-status.valid { background:rgb(var(--bamboo)); color:rgb(var(--surface)); }
        .session-manager .table-status.waiting { background:rgb(var(--line)/.45); color:rgb(var(--muted)); }
        .session-manager .table-seats { gap:8px; padding:12px; min-height:150px; }
        .session-manager .seat-slot { min-height:66px; border:1px dashed rgb(var(--line)); border-radius:2px; background:rgb(var(--surface-2)/.55); }
        .session-manager .seat-slot.occupied { border:1px solid transparent; background:transparent; }
        .session-manager .player-chip { width:64px; }
        .session-manager .chip-icon { width:44px; height:54px; border-radius:4px; border:1px solid rgb(var(--line)); background:linear-gradient(145deg,rgb(var(--surface)),rgb(var(--surface-2))); color:rgb(var(--ink)); box-shadow:2px 3px 0 rgb(var(--shadow)/.08); font-size:20px; }
        .session-manager .seat-slot .chip-icon { width:40px; height:48px; border-radius:4px; font-size:18px; }
        .session-manager .chip-name,.session-manager .player-toggle .name { color:rgb(var(--ink)); font-size:9px; margin-top:6px; }
        .session-manager .player-chip:hover .chip-icon { border-color:rgb(var(--cinnabar)); transform:translateY(-1px); }
        .session-manager .table-actions { padding:10px 12px 12px; gap:8px; border-top:1px solid rgb(var(--line)); }
        .session-manager .btn-draw,.session-manager .btn-secondary,.session-manager .btn-cancel-win { border:1px solid rgb(var(--line)); border-radius:3px; background:rgb(var(--surface-2)); color:rgb(var(--ink)); }
        .session-manager .btn-draw:hover { border-color:rgb(var(--gold)); background:rgb(var(--gold)/.1); color:rgb(var(--ink)); }
        .session-manager .btn-primary,.session-manager .btn-submit-game { border-radius:3px; background:rgb(var(--bamboo)); color:rgb(var(--surface)); box-shadow:2px 2px 0 rgb(var(--shadow)/.12); }
        .session-manager .setup-card { border-radius:3px; border-color:rgb(var(--line)); background:rgb(var(--surface)); box-shadow:3px 3px 0 rgb(var(--shadow)/.05); }
        .session-manager .setup-card h3 { color:rgb(var(--ink)); letter-spacing:.14em; }
        .session-manager .player-toggle { border:1px solid rgb(var(--line)); border-radius:3px; background:rgb(var(--surface-2)); }
        .session-manager .player-toggle.selected { border-color:rgb(var(--bamboo)); background:rgb(var(--bamboo)/.1); box-shadow:inset 0 -3px 0 rgb(var(--bamboo)); }
        .session-manager .win-panel { border-top-color:rgb(var(--gold)); background:rgb(var(--gold)/.09); color:rgb(var(--ink)); }
        .session-manager .win-panel-title { color:rgb(var(--cinnabar)); }
        .session-manager .win-type-btn,.session-manager .loser-chip,.session-manager .fan-chip { border-color:rgb(var(--line)); border-radius:3px; background:rgb(var(--surface)); color:rgb(var(--ink)); }
        .session-manager .win-type-btn.selected,.session-manager .fan-chip.selected { border-color:rgb(var(--bamboo)); background:rgb(var(--bamboo)/.1); color:rgb(var(--bamboo)); }
        .session-manager .score-preview { border-radius:3px; background:rgb(var(--ink)); }
        .session-manager .winner-choice.selected,.session-manager .winner-selected { border-color:rgb(var(--bamboo))!important; background:rgb(var(--bamboo))!important; color:#fff!important; box-shadow:0 0 0 2px rgb(var(--bamboo)/.25)!important; }
        .session-manager .discard-choice.selected,.session-manager .discard-selected { border-color:rgb(var(--cinnabar))!important; background:rgb(var(--cinnabar))!important; color:#fff!important; box-shadow:0 0 0 2px rgb(var(--cinnabar)/.22)!important; }
        .session-manager #infoOverlay,.session-manager #pickerOverlay,.session-manager #swapPickerOverlay { position:fixed!important; inset:0!important; top:0!important; align-items:center!important; justify-content:center!important; overscroll-behavior:contain; }
        .session-manager #infoOverlay[style*="display: block"] { display:flex!important; }
        .session-manager #infoOverlay>div { transform:none!important; margin:auto!important; }
        .session-manager .menu-item { background:rgb(var(--surface)); color:rgb(var(--ink)); border-color:rgb(var(--line)); }
        .session-manager .menu-item:hover { background:rgb(var(--surface-2)); }
        .session-manager .spinner { border-color:rgb(var(--line)); border-top-color:rgb(var(--cinnabar)); }
        html.dark .session-manager .header,html.dark .session-manager .table-name,html.dark .session-manager .chip-name,html.dark .session-manager .section-label,html.dark .session-manager .setup-card h3 { color:rgb(var(--ink))!important; }
        @media(max-width:640px){
          .session-manager #sessionPage{height:calc(100dvh - 112px)}.session-manager .tables-scroll{padding:10px}.session-manager .sideline-section{margin:10px 10px 0}
          .desktop-table-count { display:none; }
          .mobile-table-stepper { display:flex; align-items:center; gap:10px; }
          .session-result-dialog { display:block!important; position:fixed!important; left:50%!important; top:50%!important; transform:translate(-50%,-50%)!important; width:min(420px,calc(100vw - 24px))!important; max-height:calc(100dvh - 24px)!important; overflow-y:auto!important; z-index:12000!important; padding:16px!important; border:1px solid rgb(var(--line))!important; border-radius:6px!important; background:rgb(var(--surface))!important; color:rgb(var(--ink))!important; box-shadow:0 0 0 100vmax rgb(0 0 0/.68),0 20px 60px rgb(0 0 0/.35)!important; overscroll-behavior:contain; }
        }
      `}</style>

      <div className="header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 800 }}>🀄 Session</div>
          <div className="header-sub">{page === 'setup' ? (session.active ? 'Editing session' : 'New session') : sessionHeaderLabel}</div>
        </div>
        <div className="header-actions">
          <button className="btn-icon" type="button" onClick={() => setInfoOpen((current) => !current)} id="btnInfo">?</button>
          <button
            className="btn-icon"
            type="button"
            onClick={() => setHeaderMenuOpen((current) => !current)}
            id="btnMenu"
            style={{ display: page === 'session' ? '' : 'none' }}
          >
            ⋯
          </button>
          {headerMenuOpen ? (
            <div
              id="headerMenu"
              style={{
                display: 'block',
                position: 'absolute',
                top: 44,
                right: 10,
                background: 'white',
                borderRadius: 10,
                boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
                overflow: 'hidden',
                zIndex: 200,
                minWidth: 160
              }}
            >
              <button type="button" onClick={() => { setPage('setup'); setHeaderMenuOpen(false) }} className="menu-item">⚙️ Edit Session</button>
              <button type="button" onClick={() => { clearAllTables(); setHeaderMenuOpen(false) }} className="menu-item">⬇️ Clear All Tables</button>
              <button type="button" onClick={() => { confirmClearSession(); setHeaderMenuOpen(false) }} className="menu-item danger-item">🗑 Reset Session</button>
            </div>
          ) : null}
        </div>
      </div>

      <div id="loadingScreen" className={`page ${page === 'loading' ? 'active' : ''}`}>
        <div className="loading-screen"><div className="spinner" />
          <span>Loading session...</span>
        </div>
      </div>

      <div id="setupPage" className={`page ${page === 'setup' ? 'active' : ''}`}>
        <div className="setup-card">
          <h3>📋 Number of Tables</h3>
          <div className="desktop-table-count">
            <input
              type="number"
              min={1}
              max={99}
              value={setupTableCount}
              onChange={(event) => selectTableCount(Number(event.target.value) || 1)}
              onFocus={(event) => event.currentTarget.select()}
              style={{ width: 70, padding: '8px 10px', border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 18, fontWeight: 700, textAlign: 'center' }}
            />
            <span style={{ fontSize: 13, color: '#718096', fontWeight: 600 }}>tables</span>
          </div>
          <div className="mobile-table-stepper" role="group" aria-label="Number of tables">
            <button
              type="button"
              className="table-stepper-button"
              aria-label="Decrease number of tables"
              disabled={setupTableCount <= 1}
              onClick={() => selectTableCount(setupTableCount - 1)}
            >
              ‹
            </button>
            <output className="table-stepper-value" aria-live="polite" aria-label={`${setupTableCount} tables`}>
              {setupTableCount}
            </output>
            <button
              type="button"
              className="table-stepper-button"
              aria-label="Increase number of tables"
              disabled={setupTableCount >= 99}
              onClick={() => selectTableCount(setupTableCount + 1)}
            >
              ›
            </button>
            <span style={{ fontSize: 13, color: 'rgb(var(--muted))', fontWeight: 700 }}>tables</span>
          </div>
        </div>

        <div className="setup-card">
          <h3>👥 Select Participating Players</h3>
          <input
            type="text"
            value={setupSearch}
            onChange={(event) => setSetupSearch(event.target.value)}
            placeholder="Search players…"
            style={{ width: '100%', padding: '8px 10px', marginBottom: 8, border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
          />
          <div className="player-grid">
            {setupPlayers.map((player) => (
              <button
                key={player.id}
                type="button"
                className={`player-toggle${setupParticipants.includes(player.id) ? ' selected' : ''}`}
                onClick={() => togglePlayerSetup(player.id)}
              >
                <span className="icon">{player.icon || '👤'}</span>
                <span className="name" title={player.displayName}>{player.displayName}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="setup-card" style={{ padding: '12px 14px' }}>
          <div className="setup-footer">
            <span className="selected-count">{setupCount} player{setupCount !== 1 ? 's' : ''} selected</span>
            <button className="btn-secondary" type="button" onClick={selectAllPlayers}>All</button>
            <button className="btn-primary" type="button" onClick={startSession} disabled={setupCount < 4 || setupTableCount < 1 || savingSession}>
              {savingSession ? 'Saving...' : 'Start Session'}
            </button>
          </div>
          {setupError ? <div className="error-msg" style={{ display: 'block' }}>{setupError}</div> : null}
        </div>
      </div>

      <div id="sessionPage" className={`page ${page === 'session' ? 'active' : ''}`}>
        <div className="tables-scroll">
          <div style={{ paddingBottom: 8 }}>
            <input
              type="text"
              value={tableSearch}
              onChange={(event) => setTableSearch(event.target.value)}
              placeholder="🔍 Search table or player…"
              style={{ width: '100%', padding: '8px 10px', border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 12, background: 'white' }}
            />
          </div>
          <div className="tables-container">{renderSessionTables()}</div>
        </div>

        <div className="sideline-section">
          <div className="section-label" onClick={toggleSideline} style={{ cursor: 'pointer', userSelect: 'none' }}>
            🪑 Sideline
            <span className="badge" id="sidelineCount">{sessionSideline.length}</span>
            <span id="sidelineChevron" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--gray)' }}>{sidelineCollapsed ? '▼' : '▲'}</span>
          </div>
          <div id="sidelineBody" style={{ display: sidelineCollapsed ? 'none' : 'block' }}>
            <div
              className={`sideline-area${dragContext.player ? ' drag-over' : ''}`}
              id="sidelineArea"
              onDragOver={(event) => handleDragOver(event, 'sideline')}
              onDragLeave={(event) => handleDragLeave(event, 'sideline')}
              onDrop={(event) => handleDrop(event, 'sideline', null)}
            >
              {sessionSideline.length === 0 ? (
                <div className="sideline-empty" id="sidelineEmpty">All players at tables!</div>
              ) : (
                sessionSideline.map((playerId) => {
                  const info = playerInfo(playerId)
                  return (
                    <div
                      key={playerId}
                      className="player-chip"
                      draggable
                      data-player={playerId}
                      data-source="sideline"
                      onDragStart={(event) => handleDragStart(event, playerId, 'sideline')}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="chip-icon">{info.icon || '👤'}</div>
                      <div className="chip-name" title={info.displayName}>{shortName(info.displayName)}</div>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        </div>
      </div>

      {toast ? <div className="toast active">{toast}</div> : null}
      {flash && typeof document !== 'undefined' ? createPortal(
        <div className="score-flash" role="status" aria-live="polite">
          <div className="celebration-confetti" aria-hidden="true">
            {['🀄', '🎉', '✨', '🎊', '🌸', '⭐', '🧧', '🍀'].map((symbol, index) => <span key={index} style={{ '--burst-index': index } as React.CSSProperties}>{symbol}</span>)}
          </div>
          <div className="score-flash-card">
            {flash.winner ? (
              <>
                <p className="celebration-kicker">Game recorded</p>
                <div className="celebration-winner-icon">{playerInfo(flash.winner).icon || '🏆'}</div>
                <div className="flash-title">{playerInfo(flash.winner).displayName} wins!</div>
                <p className="celebration-subtitle">A winning hand for the table</p>
              </>
            ) : <div className="flash-title">🤝 Draw recorded</div>}
            <div className="flash-scores">
              {Object.entries(flash.scores).map(([playerId, score]) => {
                const info = playerInfo(playerId)
                const cls = score > 0 ? 'pos' : score < 0 ? 'neg' : ''
                return <div key={playerId} className={`flash-row ${playerId === flash.winner ? 'winner-row' : ''}`}><span>{info.icon || '👤'} {shortName(info.displayName)}</span><span className={`flash-score-val ${cls}`}>{score > 0 ? `+${score}` : score}</span></div>
              })}
            </div>
          </div>
        </div>,
        document.body
      ) : null}
      {infoOpen && typeof document !== 'undefined' ? createPortal(<div id="infoOverlay" role="dialog" aria-modal="true" aria-labelledby="session-help-title" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', zIndex: 20010, padding: 16, overflowY: 'auto' }}>
        <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', maxWidth: 380, maxHeight: 'calc(100vh - 104px)', margin: '0 auto', transform: 'translateX(-32px)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div id="session-help-title" style={{ fontSize: 16, fontWeight: 800, color: 'white' }}>🀄 Session Manager</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>How it works</div>
            </div>
            <button type="button" onClick={() => setInfoOpen(false)} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, color: 'white', fontSize: 18, width: 32, height: 32, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          </div>
          <div style={{ padding: '16px 18px', display: 'flex', minHeight: 0, flexDirection: 'column', gap: 14, overflowY: 'auto', overscrollBehavior: 'contain' }}>
            <div className="info-section">
              <div className="info-icon">📋</div>
              <div>
                <div className="info-title">What is a Session?</div>
                <div className="info-body">A session is a single mahjong night. You choose which players are attending and how many tables are running. The session tracks who is seated where and records all games played during the night.</div>
              </div>
            </div>
            <div className="info-section">
              <div className="info-icon">📅</div>
              <div>
                <div className="info-title">What is a Season?</div>
                <div className="info-body">A season is a chapter of club standings. Starting a new season closes the current live session and gives the leaderboard a fresh set of season statistics, while keeping earlier seasons and game history available to review.</div>
              </div>
            </div>
            <div className="info-section">
              <div className="info-icon">🔢</div>
              <div>
                <div className="info-title">Number of Tables</div>
                <div className="info-body">Set how many tables will be running simultaneously. Each table seats exactly 4 players. You can have as many tables as you need.</div>
              </div>
            </div>
            <div className="info-section">
              <div className="info-icon">👥</div>
              <div>
                <div className="info-title">Selecting Players</div>
                <div className="info-body">Choose all players attending tonight. Anyone not selected won&apos;t appear in the session. You need at least 4 players to start. Use the search bar to find players quickly.</div>
              </div>
            </div>
            <div className="info-section">
              <div className="info-icon">🪑</div>
              <div>
                <div className="info-title">Sideline</div>
                <div className="info-body">Players who are attending but not currently seated at a table sit on the sideline. Drag them to a table when they&apos;re ready to play, or drag them back to the sideline between rounds.</div>
              </div>
            </div>
            <div className="info-section">
              <div className="info-icon">🎴</div>
              <div>
                <div className="info-title">Recording a Game</div>
                <div className="info-body">Once a table has 4 players it shows <strong>✓ Ready</strong>. After a game finishes, tap <strong>Winner...</strong> to record who won, the win type (self-draw or discard), and the fan count. Or tap <strong>Draw</strong> if no one won.</div>
              </div>
            </div>
            <div className="info-section">
              <div className="info-icon">🀄</div>
              <div>
                <div className="info-title">Fan Scoring</div>
                <div className="info-body">Scores are based on fan count (3–13+). <strong>Self-draw:</strong> winner gets 3× base, each loser pays 1× base. <strong>Discard win:</strong> winner gets 2× base, the discarder pays 2× base, others pay nothing.</div>
              </div>
            </div>
            <div style={{ background: '#f7fafc', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#4a5568', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Fan → Base Points</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
                {Object.entries(FAN_POINTS).map(([fanValue, points]) => (
                  <div key={fanValue} style={{ background: 'white', borderRadius: 6, padding: '4px 6px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                    <div style={{ fontSize: 10, color: '#718096' }}>{fanValue} fan</div>
                    <div style={{ fontSize: 12, fontWeight: 800, color: '#667eea' }}>{points}</div>
                  </div>
                ))}
                <div style={{ background: 'white', borderRadius: 6, padding: '4px 6px', textAlign: 'center', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: 10, color: '#718096' }}>13+ fan</div>
                  <div style={{ fontSize: 12, fontWeight: 800, color: '#667eea' }}>384</div>
                </div>
              </div>
            </div>
            <div className="info-section">
              <div className="info-icon">⚙️</div>
              <div>
                <div className="info-title">Edit / Clear All Tables / Reset</div>
                <div className="info-body"><strong>Edit</strong> lets you change which players are in the session or the number of tables. <strong>Clear All Tables</strong> moves everyone back to the sideline without ending the session. <strong>Reset Session</strong> wipes everything and starts fresh.</div>
              </div>
            </div>
          </div>
        </div>
      </div>, document.body) : null}

      {pickerTableId && typeof document !== 'undefined' ? createPortal(<div id="pickerOverlay" role="dialog" aria-modal="true" aria-labelledby="add-player-title" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', zIndex: 20010, padding: 16, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', width: '100%', maxWidth: 340, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div id="add-player-title" style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>Add Player to Table {pickerTableId}</div>
            <button type="button" onClick={closePicker} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, color: 'white', fontSize: 18, width: 30, height: 30, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
            <div style={{ marginBottom: 7, fontSize: 11, fontWeight: 800, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Selected ({(session.tables[pickerTableId] || []).length}/4)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(session.tables[pickerTableId] || []).length === 0 ? <span style={{ fontSize: 12, color: '#64748b' }}>No players selected yet.</span> : (session.tables[pickerTableId] || []).map((playerId) => {
                const info = playerInfo(playerId)
                return <button key={playerId} type="button" onClick={() => removeToSideline(pickerTableId, playerId)} title={`Remove ${info.displayName} from this table`} style={{ display: 'inline-flex', minHeight: 36, alignItems: 'center', gap: 6, border: '1px solid #94a3b8', borderRadius: 6, background: 'white', padding: '5px 8px', color: '#1e293b', fontSize: 12, fontWeight: 700 }}><span>{info.icon}</span><span>{shortName(info.displayName)}</span><span aria-hidden="true">×</span></button>
              })}
            </div>
          </div>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
            <input
              type="text"
              value={pickerSearch}
              onChange={(event) => setPickerSearch(event.target.value)}
              placeholder="Search players…"
              style={{ width: '100%', padding: '8px 10px', border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
            />
          </div>
          <div id="pickerList" style={{ overflowY: 'auto', padding: '8px 12px', display: 'flex', flexWrap: 'wrap', gap: 8, minHeight: 80 }}>
            {pickerAvailable.length === 0 ? null : pickerAvailable.map((playerId) => {
              const info = playerInfo(playerId)
              return (
                <button
                  key={playerId}
                  type="button"
                  onClick={() => pickPlayer(playerId)}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 60, cursor: 'pointer', padding: '6px 4px', borderRadius: 8, border: '2px solid #e2e8f0', background: 'white', transition: 'all 0.15s' }}
                >
                  <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#ebf4ff,#e9d8fd)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{info.icon || '👤'}</div>
                  <div style={{ fontSize: 9, fontWeight: 700, color: '#4a5568', marginTop: 4, textAlign: 'center', maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortName(info.displayName)}</div>
                </button>
              )
            })}
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#a0aec0', textAlign: 'center' }} id="pickerEmpty">
            {pickerAvailable.length === 0 ? (pickerSearch ? 'No players match your search.' : 'No players on sideline.') : ''}
          </div>
        </div>
      </div>, document.body) : null}

      {swapPickerTableId && typeof document !== 'undefined' ? createPortal(<div id="swapPickerOverlay" role="dialog" aria-modal="true" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', zIndex: 20010, padding: 16, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', width: '100%', maxWidth: 340, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>Swap {swapPickerPlayer ? shortName(playerInfo(swapPickerPlayer).displayName) : ''}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>Select a player to swap with</div>
            </div>
            <button type="button" onClick={closeSwapPicker} style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, color: 'white', fontSize: 18, width: 30, height: 30, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
            <input
              type="text"
              value={swapPickerSearch}
              onChange={(event) => setSwapPickerSearch(event.target.value)}
              placeholder="Search players…"
              style={{ width: '100%', padding: '8px 10px', border: '2px solid #e2e8f0', borderRadius: 8, fontSize: 13 }}
            />
          </div>
          <div id="swapPickerList" style={{ overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 80 }}>
            {swapPickerAvailable.length === 0 ? <div id="swapPickerEmpty" style={{ padding: '6px 12px', fontSize: 11, color: '#a0aec0', textAlign: 'center' }}>No players match your search.</div> : swapPickerAvailable.map((playerId) => {
              const info = playerInfo(playerId)
              const location = session.tables && Object.entries(session.tables).find(([, playersOnTable]) => playersOnTable.includes(playerId))
              const locationLabel = location ? `Table ${location[0]}` : 'Sideline'
              const locationColor = location ? '#667eea' : '#48bb78'
              return (
                <button
                  key={playerId}
                  type="button"
                  onClick={() => doSwap(playerId)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8, border: '2px solid #e2e8f0', background: 'white', cursor: 'pointer', transition: 'all 0.15s' }}
                >
                  <div style={{ width: 36, height: 36, background: 'linear-gradient(135deg,#ebf4ff,#e9d8fd)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0 }}>{info.icon || '👤'}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: '#2d3748' }}>{info.displayName}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: locationColor }}>{locationLabel}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#a0aec0' }}>⇄</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>, document.body) : null}
    </div>
  )
}
