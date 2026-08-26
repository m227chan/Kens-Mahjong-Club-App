'use client'

import { type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent, type WheelEvent as ReactWheelEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Link from 'next/link'
import MenuGlyph from '@/components/MenuGlyph'
import ViewHeader from '@/components/ViewHeader'
import ScoreCelebration, { type ScoreCelebrationResult } from '@/components/ScoreCelebration'
import TableShuffleModal from '@/components/TableShuffleModal'
import { useAuth } from '@/contexts/AuthContext'
import { useSound } from '@/contexts/SoundContext'
import { useGameSync } from '@/contexts/GameSyncContext'
import {
  closeSession,
  createSession,
  subscribeActiveSession,
  subscribePlayers,
  updateSession
} from '@/lib/data'
import type { PlayerDoc } from '@/lib/types'
import { calculateTableScores } from '@/lib/table-scoring'
import {
  basePointsForFan,
  DEFAULT_SCORING_RULES,
  fanLabel,
  fanValues,
  type ScoringRules,
} from '@/lib/scoring-rules'
import { getQrEnrollmentSetting, setQrEnrollmentSetting, tableAction, type TableSession } from '@/lib/table-checkin-client'
import { useModalFocus } from '@/lib/use-modal-focus'
import {
  optimisticallyClearAllTables,
  optimisticallyClearTable,
  optimisticallyRemovePlayer,
  optimisticallySeatPlayer,
} from '@/lib/optimistic-session'
import { MAX_SESSION_TABLES, MIN_SESSION_TABLES, clampSessionTableCount } from '@/lib/session-layout'

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

const fromTableSession = (next: TableSession): SessionState => ({
  id: next.id,
  active: true,
  tableCount: next.tableCount,
  participants: next.participants,
  tables: next.tables,
  sideline: next.sideline,
})

function AddPlayerActionIcon() {
  return (
    <svg className="session-action-icon" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="8.5" cy="7" r="4" />
      <path d="M19 8v6M16 11h6" />
    </svg>
  )
}

export default function SessionManager({ clubId, seasonNumber, players: suppliedPlayers, isManager = false, scoringRules = DEFAULT_SCORING_RULES, onAddPlayer }: { clubId: string; seasonNumber: number; players?: PlayerDoc[]; isManager?: boolean; scoringRules?: ScoringRules; onAddPlayer?: () => void }) {
  const { user, loading, isAdmin } = useAuth()
  const { play } = useSound()
  const { saveGame } = useGameSync()
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
  const [flash, setFlash] = useState<ScoreCelebrationResult | null>(null)
  const [collapsedTables, setCollapsedTables] = useState<Record<string, boolean>>({})
  const [activeTableId, setActiveTableId] = useState<string | null>(null)
  const [sidelineCollapsed, setSidelineCollapsed] = useState(true)
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false)
  const [headerMenuMobile, setHeaderMenuMobile] = useState(false)
  const [shuffleOpen, setShuffleOpen] = useState(false)
  const [headerMenuAnchor, setHeaderMenuAnchor] = useState<{
    top: number | 'auto'
    bottom: number | 'auto'
    right: number
    maxHeight: number
  }>({ top: 0, bottom: 'auto', right: 12, maxHeight: 420 })
  const [savingSession, setSavingSession] = useState(false)
  const [qrAutoEnroll, setQrAutoEnroll] = useState<boolean | null>(null)
  const [savingQrEnrollment, setSavingQrEnrollment] = useState(false)

  const dragPlayerRef = useRef<string | null>(null)
  const dragSourceRef = useRef<string | null>(null)
  const tableJumpDragRef = useRef<{
    pointerId: number
    startX: number
    startY: number
    startScrollLeft: number
    dragging: boolean
  } | null>(null)
  const suppressTableJumpClickRef = useRef(false)
  const gameRequestRef = useRef(new Map<string, { fingerprint: string; key: string }>())
  const sessionRef = useRef<SessionState>(initialSession)
  const confirmedSessionRef = useRef<SessionState>(initialSession)
  const pendingLayoutMutationsRef = useRef(0)
  const layoutMutationQueueRef = useRef<Promise<void>>(Promise.resolve())
  const initializedSessionLayoutRef = useRef('')
  const headerMenuTriggerRef = useRef<HTMLButtonElement>(null)
  const headerMenuRef = useRef<HTMLDivElement>(null)
  const headerMenuLayerRef = useRef<HTMLDivElement>(null)
  const headerMenuSurfaceRef = useRef<HTMLElement>(null)
  const setupHeadingRef = useRef<HTMLHeadingElement>(null)
  const headerMenuInitialFocusRef = useRef<'first' | 'last'>('first')

  const positionHeaderMenu = useCallback((trigger: HTMLButtonElement | null = headerMenuTriggerRef.current) => {
    if (!trigger) return
    const rect = trigger.getBoundingClientRect()
    const gap = 8
    const viewportMargin = 12
    const availableBelow = Math.max(0, window.innerHeight - rect.bottom - gap - viewportMargin)
    const availableAbove = Math.max(0, rect.top - gap - viewportMargin)
    const desiredHeight = Math.min(420, Math.max(0, window.innerHeight - viewportMargin * 2))
    const placeAbove = availableBelow < desiredHeight && availableAbove > availableBelow
    setHeaderMenuAnchor({
      top: placeAbove ? 'auto' : Math.max(viewportMargin, rect.bottom + gap),
      bottom: placeAbove ? Math.max(viewportMargin, window.innerHeight - rect.top + gap) : 'auto',
      right: Math.max(12, window.innerWidth - rect.right),
      maxHeight: placeAbove ? availableAbove : availableBelow,
    })
  }, [])

  const closeHeaderMenu = useCallback((restoreFocus = false) => {
    setHeaderMenuOpen(false)
    if (restoreFocus) {
      window.requestAnimationFrame(() => headerMenuTriggerRef.current?.focus())
    }
  }, [])

  const dismissHeaderMenu = useCallback(() => closeHeaderMenu(true), [closeHeaderMenu])
  const getHeaderMenuInitialFocus = useCallback(
    () => headerMenuRef.current?.querySelector<HTMLElement>('[data-session-action]') ?? null,
    [],
  )

  useModalFocus({
    open: headerMenuOpen && headerMenuMobile,
    layerRef: headerMenuLayerRef,
    dialogRef: headerMenuSurfaceRef,
    getInitialFocus: getHeaderMenuInitialFocus,
    onEscape: dismissHeaderMenu,
  })

  const openHeaderMenu = useCallback((trigger: HTMLButtonElement, initialFocus: 'first' | 'last' = 'first') => {
    headerMenuInitialFocusRef.current = initialFocus
    setHeaderMenuMobile(window.matchMedia?.('(max-width: 767px)').matches ?? window.innerWidth <= 767)
    positionHeaderMenu(trigger)
    setHeaderMenuOpen(true)
  }, [positionHeaderMenu])

  const showSession = useCallback((next: SessionState) => {
    sessionRef.current = next
    setSession(next)
  }, [])

  const acceptServerSession = useCallback((next: SessionState) => {
    confirmedSessionRef.current = next
    if (pendingLayoutMutationsRef.current === 0) showSession(next)
  }, [showSession])

  const gameRequestKey = (tableId: string, value: unknown) => {
    const fingerprint = JSON.stringify(value)
    const pending = gameRequestRef.current.get(tableId)
    if (pending?.fingerprint === fingerprint) return pending.key
    const key = crypto.randomUUID()
    gameRequestRef.current.set(tableId, { fingerprint, key })
    return key
  }

  useEffect(() => {
    if (!isManager || !user) return
    void getQrEnrollmentSetting(clubId)
      .then((setting) => setQrAutoEnroll(setting.autoEnroll))
      .catch(() => setQrAutoEnroll(null))
  }, [clubId, isManager, user])

  const toggleQrEnrollment = async () => {
    if (qrAutoEnroll === null || savingQrEnrollment) return
    const next = !qrAutoEnroll
    setSavingQrEnrollment(true)
    try {
      const setting = await setQrEnrollmentSetting(clubId, next)
      setQrAutoEnroll(setting.autoEnroll)
      showToast(setting.autoEnroll ? 'QR automatic enrollment enabled.' : 'QR scans now require manager approval.')
    } catch {
      showToast('Unable to update QR enrollment.')
    } finally {
      setSavingQrEnrollment(false)
    }
  }

  useEffect(() => {
    const playerUnsub = suppliedPlayers ? undefined : subscribePlayers(clubId, setSubscribedPlayers)
    const sessionUnsub = subscribeActiveSession(
      clubId,
      seasonNumber,
      (nextSession) => {
        if (nextSession && nextSession.isActive) {
          acceptServerSession({
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
          acceptServerSession(initialSession)
          setSetupParticipants([])
          setSetupTableCount(1)
          setPage('setup')
        }
      },
      (error) => {
        console.error('Unable to load active session.', error)
        acceptServerSession(initialSession)
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
  }, [acceptServerSession, clubId, seasonNumber, suppliedPlayers])

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
    const media = window.matchMedia?.('(max-width: 767px)')
    const sync = () => setHeaderMenuMobile(media?.matches ?? window.innerWidth <= 767)
    sync()
    media?.addEventListener?.('change', sync)
    return () => media?.removeEventListener?.('change', sync)
  }, [])

  useEffect(() => {
    if (!headerMenuOpen || headerMenuMobile) return
    const frame = window.requestAnimationFrame(() => {
      const items = Array.from(headerMenuRef.current?.querySelectorAll<HTMLElement>(
        '[role="menuitem"], [role="menuitemcheckbox"]',
      ) ?? []).filter((item) => item.getAttribute('aria-disabled') !== 'true' && !('disabled' in item && item.disabled))
      const item = headerMenuInitialFocusRef.current === 'last' ? items[items.length - 1] : items[0]
      items.forEach((candidate) => { candidate.tabIndex = candidate === item ? 0 : -1 })
      item?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [headerMenuMobile, headerMenuOpen])

  useEffect(() => {
    if (!headerMenuOpen) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      closeHeaderMenu(true)
    }
    const syncPresentation = () => {
      const mobile = window.matchMedia?.('(max-width: 767px)').matches ?? window.innerWidth <= 767
      setHeaderMenuMobile(mobile)
      if (!mobile) positionHeaderMenu()
    }
    if (!headerMenuMobile) document.addEventListener('keydown', handleEscape)
    window.addEventListener('resize', syncPresentation)
    if (!headerMenuMobile) window.addEventListener('scroll', syncPresentation)
    return () => {
      if (!headerMenuMobile) document.removeEventListener('keydown', handleEscape)
      window.removeEventListener('resize', syncPresentation)
      if (!headerMenuMobile) window.removeEventListener('scroll', syncPresentation)
    }
  }, [closeHeaderMenu, headerMenuMobile, headerMenuOpen, positionHeaderMenu])

  useEffect(() => {
    if (page !== 'session' && headerMenuOpen) closeHeaderMenu(false)
  }, [closeHeaderMenu, headerMenuOpen, page])

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
  const sessionParticipants = useMemo(() => {
    return players.filter((player) => session.participants.includes(player.id))
  }, [players, session.participants])

  const sessionTables = useMemo(() => {
    return Array.from({ length: session.tableCount }, (_, index) => session.tables[String(index + 1)] ?? [])
  }, [session.tableCount, session.tables])

  const linkedSessionPlayerId = useMemo(() => {
    if (!user) return null
    return players.find((player) => player.authUid === user.uid && session.participants.includes(player.id))?.id ?? null
  }, [players, session.participants, user])

  const currentUserTableId = useMemo(() => {
    if (!linkedSessionPlayerId) return null
    const table = Object.entries(session.tables).find(([, playerIds]) => playerIds.includes(linkedSessionPlayerId))
    return table?.[0] ?? null
  }, [linkedSessionPlayerId, session.tables])

  useEffect(() => {
    if (!session.active || session.tableCount < 1) return
    const layoutKey = `${session.id ?? 'active'}:${session.tableCount}:${currentUserTableId ?? 'none'}`
    if (initializedSessionLayoutRef.current === layoutKey) return
    initializedSessionLayoutRef.current = layoutKey

    if (session.tableCount >= 5) {
      setCollapsedTables(Object.fromEntries(
        Array.from({ length: session.tableCount }, (_, index) => {
          const tableId = String(index + 1)
          return [tableId, tableId !== currentUserTableId]
        }),
      ))
    } else {
      setCollapsedTables({})
    }
    setActiveTableId(currentUserTableId ?? '1')
    setSidelineCollapsed(true)
  }, [currentUserTableId, session.active, session.id, session.tableCount])

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

  const visibleTableIds = useMemo(
    () => filteredTableCards.filter((table) => table.visible).map((table) => table.tableId),
    [filteredTableCards],
  )

  useEffect(() => {
    if (visibleTableIds.length === 0) {
      setActiveTableId(null)
      return
    }

    setActiveTableId((current) => {
      if (current && visibleTableIds.includes(current)) return current
      if (currentUserTableId && visibleTableIds.includes(currentUserTableId)) return currentUserTableId
      return visibleTableIds[0]
    })
  }, [currentUserTableId, visibleTableIds])

  const dragContext = { player: dragPlayerRef.current, source: dragSourceRef.current }

  const togglePlayerSetup = (playerId: string) => {
    setSetupParticipants((current) =>
      current.includes(playerId) ? current.filter((id) => id !== playerId) : [...current, playerId]
    )
  }

  const selectTableCount = (value: number) => {
    const nextCount = clampSessionTableCount(value)
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

  const queueLayoutMutation = (
    optimistic: SessionState,
    write: () => Promise<SessionState>,
    failureMessage: string,
  ) => {
    showSession(optimistic)
    pendingLayoutMutationsRef.current += 1
    layoutMutationQueueRef.current = layoutMutationQueueRef.current.then(async () => {
      try {
        confirmedSessionRef.current = await write()
      } catch (error) {
        play('error')
        showToast(error instanceof Error ? error.message : failureMessage)
      } finally {
        pendingLayoutMutationsRef.current -= 1
        if (pendingLayoutMutationsRef.current === 0) {
          showSession(confirmedSessionRef.current)
          setSetupTableCount(confirmedSessionRef.current.tableCount)
        }
      }
    })
  }

  const persistSession = (nextSession: SessionState) => {
    if (!nextSession.id) {
      showSession(nextSession)
      return
    }
    queueLayoutMutation(
      nextSession,
      async () => {
        await updateSession(clubId, nextSession.id!, {
          tableCount: nextSession.tableCount,
          participants: nextSession.participants,
          tables: nextSession.tables,
          sideline: nextSession.sideline
        })
        return nextSession
      },
      'Unable to save that table change. It was reverted.',
    )
  }

  const adjustActiveTableCount = (change: -1 | 1) => {
    const current = sessionRef.current
    if (loading) return
    if (!user) {
      showToast('Sign in to change the session tables.')
      return
    }
    if (!current.active || !current.id) {
      showToast('The active session is not ready yet.')
      return
    }

    const nextCount = clampSessionTableCount(current.tableCount + change)
    if (nextCount === current.tableCount) return

    const nextTables = Object.fromEntries(
      Array.from({ length: nextCount }, (_, index) => {
        const tableId = String(index + 1)
        return [tableId, current.tables[tableId] ?? []]
      }),
    )
    const retainedPlayers = new Set(Object.values(nextTables).flat())
    const removedPlayers = change < 0
      ? Array.from({ length: current.tableCount - nextCount }, (_, index) => current.tables[String(nextCount + index + 1)] ?? []).flat()
      : []
    const nextSideline = Array.from(new Set([...current.sideline, ...removedPlayers]))
      .filter((playerId) => current.participants.includes(playerId) && !retainedPlayers.has(playerId))
    const nextSession = { ...current, tableCount: nextCount, tables: nextTables, sideline: nextSideline }

    setSetupTableCount(nextCount)
    setCollapsedTables((collapsed) => Object.fromEntries(
      Object.entries(collapsed).filter(([tableId]) => Number(tableId) <= nextCount),
    ))
    setActiveTableId((tableId) => tableId && Number(tableId) > nextCount ? String(nextCount) : tableId)
    persistSession(nextSession)

    if (removedPlayers.length > 0) {
      showToast(`Table ${current.tableCount} removed. ${removedPlayers.length} player${removedPlayers.length === 1 ? '' : 's'} moved to the sideline.`)
    }
  }

  const openAddPlayerFlow = () => {
    closeHeaderMenu(false)
    onAddPlayer?.()
  }

  const handleHeaderMenuKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Tab') {
      event.preventDefault()
      const trigger = headerMenuTriggerRef.current
      const focusableSelector = [
        'a[href]',
        'button:not([disabled])',
        'input:not([disabled])',
        'select:not([disabled])',
        'textarea:not([disabled])',
        '[tabindex]:not([tabindex="-1"])',
      ].join(',')
      const focusableOutsideMenu = Array.from(document.querySelectorAll<HTMLElement>(focusableSelector))
        .filter((candidate) => !candidate.closest('.session-actions-layer'))
        .filter((candidate) => !candidate.closest('[hidden], [aria-hidden="true"]'))
        .filter((candidate) => candidate.getClientRects().length > 0)
      const triggerIndex = trigger ? focusableOutsideMenu.indexOf(trigger) : -1
      const destination = triggerIndex < 0
        ? trigger
        : event.shiftKey
          ? focusableOutsideMenu[Math.max(0, triggerIndex - 1)]
          : focusableOutsideMenu[Math.min(focusableOutsideMenu.length - 1, triggerIndex + 1)]
      closeHeaderMenu(false)
      window.requestAnimationFrame(() => (destination ?? trigger)?.focus())
      return
    }
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return
    const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>(
      '[role="menuitem"], [role="menuitemcheckbox"]',
    )).filter((item) => item.getAttribute('aria-disabled') !== 'true' && !('disabled' in item && item.disabled))
    if (items.length === 0) return

    event.preventDefault()
    const currentIndex = items.indexOf(document.activeElement as HTMLElement)
    let nextIndex = 0
    if (event.key === 'End') nextIndex = items.length - 1
    else if (event.key === 'ArrowUp') nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1
    else if (event.key === 'ArrowDown') nextIndex = currentIndex < 0 || currentIndex === items.length - 1 ? 0 : currentIndex + 1

    items.forEach((item, index) => { item.tabIndex = index === nextIndex ? 0 : -1 })
    items[nextIndex]?.focus()
  }

  const queueTableAction = (
    optimistic: SessionState,
    request: () => Promise<{ status: 'ok'; session: TableSession } | { status: 'table_full'; session?: TableSession }>,
    failureMessage: string,
  ) => {
    queueLayoutMutation(
      optimistic,
      async () => {
        const result = await request()
        if (result.status === 'table_full') {
          if (result.session) confirmedSessionRef.current = fromTableSession(result.session)
          throw new Error('That table filled up before the change was saved.')
        }
        return fromTableSession(result.session)
      },
      failureMessage,
    )
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
        acceptServerSession(nextSession)
      } else {
        const sessionId = await createSession(clubId, {
          createdBy: user?.uid ?? 'anonymous',
          participants: setupParticipants,
          tableCount: setupTableCount,
          seasonNumber,
          tables: nextTables,
          sideline
        })
        acceptServerSession({ ...nextSession, id: sessionId })
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
    if (!winner || !type || type === 'draw' || !fanCount || !tableId) return null
    if (type === 'discard' && !loser) return null

    const playersOnTable = session.tables[tableId] || []
    return calculateTableScores({ players: playersOnTable, winner, winType: type, loser, fan: fanCount, rules: scoringRules })
  }

  const submitWin = async (tableId: string) => {
    const scores = calcScores()
    if (!scores) { play('error'); return }
    if (!user) {
      play('error')
      showToast('Sign in to record games.')
      return
    }

    const requestValue = { scores, seasonNumber, winType: winState.winType, loser: winState.loser, fan: winState.fan }
    const idempotencyKey = gameRequestKey(tableId, requestValue)
    setSavingGameTable(tableId)
    try {
      const result = await saveGame(clubId, {
        entries: Object.entries(scores).map(([playerId, score]) => ({ playerId, score })),
        createdBy: user.uid,
        seasonNumber,
        tableId,
        winType: winState.winType === 'self' ? 'self_draw' : 'discard',
        loserPlayerId: winState.winType === 'discard' ? winState.loser : null,
        fan: winState.winType === 'draw' ? null : winState.fan,
        notes: null,
        idempotencyKey
      })
      gameRequestRef.current.delete(tableId)
      play('win')
      setFlash({ scores, winner: winState.winner })
      closeAllWinPanels()
      setWinState(initialWinState)
      showToast(result.status === 'synced'
        ? 'Game synced.'
        : result.status === 'queued'
          ? 'Game saved on this device. It will sync when the connection returns.'
          : 'Game saved on this device, but syncing needs attention.')
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

    const idempotencyKey = gameRequestKey(tableId, { scores, seasonNumber, winType: 'draw' })
    setSavingGameTable(tableId)
    try {
      const result = await saveGame(clubId, {
        entries: Object.entries(scores).map(([playerId, score]) => ({ playerId, score })),
        createdBy: user.uid,
        seasonNumber,
        tableId,
        winType: 'draw',
        loserPlayerId: null,
        fan: null,
        notes: null,
        idempotencyKey
      })
      gameRequestRef.current.delete(tableId)
      play('draw')
      setFlash({ scores, winner: null })
      showToast(result.status === 'synced'
        ? 'Draw synced.'
        : result.status === 'queued'
          ? 'Draw saved on this device. It will sync when the connection returns.'
          : 'Draw saved on this device, but syncing needs attention.')
    } catch (error) {
      play('error')
      showToast(error instanceof Error ? error.message : 'Unable to save draw.')
    } finally {
      setSavingGameTable(null)
    }
  }

  const confirmClearSession = async () => {
    if (!window.confirm('Reset this session? Table assignments and participation will be cleared.')) return false
    if (session.id) {
      try {
        await closeSession(clubId, session.id)
      } catch {
        showToast('Unable to reset session.')
        return false
      }
    }
    acceptServerSession(initialSession)
    setSetupParticipants([])
    setSetupTableCount(1)
    setPage('setup')
    window.requestAnimationFrame(() => setupHeadingRef.current?.focus())
    showToast('Session cleared!')
    return true
  }

  const clearAllTables = () => {
    const optimistic = optimisticallyClearAllTables(sessionRef.current)
    queueTableAction(
      optimistic,
      () => tableAction<{ status: 'ok'; session: TableSession }>({ action: 'clearAll', clubId }),
      'Unable to clear tables. The previous layout was restored.',
    )
    play('tile')
    showToast('All tables cleared.')
  }

  const openTableShuffle = () => {
    if (!user) {
      showToast('Sign in to shuffle tables.')
      return
    }
    if (!sessionRef.current.active || !sessionRef.current.id) {
      showToast('The active session is not ready yet.')
      return
    }
    setShuffleOpen(true)
  }

  const confirmTableShuffle = (nextTables: Record<string, string[]>) => {
    const current = sessionRef.current
    if (!current.active || !current.id) {
      showToast('The active session is not ready yet.')
      setShuffleOpen(false)
      return
    }
    persistSession({ ...current, tables: nextTables })
    setShuffleOpen(false)
    play('tile')
    showToast('Tables shuffled.')
  }

  const clearSingleTable = (tableId: string) => {
    const optimistic = optimisticallyClearTable(sessionRef.current, tableId)
    queueTableAction(
      optimistic,
      () => tableAction<{ status: 'ok'; session: TableSession }>({ action: 'clear', clubId, tableNumber: Number(tableId) }),
      'Unable to clear the table. The previous layout was restored.',
    )
    play('tile')
    showToast('Table cleared.')
  }

  const removeToSideline = (tableId: string, playerId: string) => {
    const optimistic = optimisticallyRemovePlayer(sessionRef.current, tableId, playerId)
    queueTableAction(
      optimistic,
      () => tableAction<{ status: 'ok'; session: TableSession }>({ action: 'remove', clubId, tableNumber: Number(tableId), playerId }),
      'Unable to remove that player. The previous layout was restored.',
    )
    play('tile')
  }

  const toggleTable = (tableId: string) => {
    setCollapsedTables((current) => ({ ...current, [tableId]: !current[tableId] }))
  }

  const toggleSideline = () => {
    setSidelineCollapsed((current) => !current)
  }

  const scrollTableIntoView = useCallback((tableId: string, focusTable = false) => {
    const table = document.getElementById('table-' + tableId)
    if (!table) return

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const behavior: ScrollBehavior = reducedMotion ? 'auto' : 'smooth'
    table.scrollIntoView({ behavior, block: 'start', inline: 'nearest' })

    if (focusTable) {
      table.querySelector<HTMLElement>('.table-name')?.focus({ preventScroll: true })
    }
  }, [])

  const jumpToTable = (tableId: string) => {
    setTableSearch('')
    setActiveTableId(tableId)
    setCollapsedTables((current) => ({ ...current, [tableId]: false }))
    window.setTimeout(() => {
      scrollTableIntoView(tableId, true)
    }, 40)
  }

  const beginTableJumpDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || event.button !== 0) return
    tableJumpDragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      startScrollLeft: event.currentTarget.scrollLeft,
      dragging: false,
    }
  }

  const moveTableJumpDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = tableJumpDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    const deltaX = event.clientX - drag.startX
    const deltaY = event.clientY - drag.startY

    if (!drag.dragging) {
      if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 6) return
      if (Math.abs(deltaY) >= Math.abs(deltaX)) {
        tableJumpDragRef.current = null
        return
      }
      drag.dragging = true
      suppressTableJumpClickRef.current = true
      event.currentTarget.setPointerCapture(event.pointerId)
    }

    event.preventDefault()
    event.currentTarget.scrollLeft = drag.startScrollLeft - deltaX
  }

  const endTableJumpDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = tableJumpDragRef.current
    if (!drag || drag.pointerId !== event.pointerId) return
    tableJumpDragRef.current = null
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (drag.dragging) {
      window.setTimeout(() => {
        suppressTableJumpClickRef.current = false
      }, 0)
    }
  }

  const scrollTableJumpsWithWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return
    event.preventDefault()
    event.currentTarget.scrollLeft += event.deltaY
  }

  const openPicker = (tableId: string) => {
    setPickerTableId(tableId)
    setPickerSearch('')
  }

  const closePicker = () => {
    setPickerTableId(null)
    setPickerSearch('')
  }

  const pickPlayer = (playerId: string) => {
    if (!pickerTableId) return
    const playersOnTable = session.tables[pickerTableId] || []
    if (playersOnTable.length >= 4) {
      play('error')
      showToast('Table is full.')
      return
    }
    if (playersOnTable.includes(playerId)) return

    const optimistic = optimisticallySeatPlayer(sessionRef.current, pickerTableId, playerId)
    queueTableAction(
      optimistic,
      () => tableAction<{ status: 'ok'; session: TableSession } | { status: 'table_full'; session: TableSession }>({ action: 'seat', clubId, tableNumber: Number(pickerTableId), playerId }),
      'Unable to add that player. The previous layout was restored.',
    )
    play('tile')
    if ((optimistic.tables[pickerTableId] ?? []).length >= 4) closePicker()
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
          aria-pressed={selected}
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
          aria-pressed={selected}
          onClick={() => setLoser(tableId, playerId)}
        >
          {info.icon ?? '👤'} {shortName(info.displayName)}
        </button>
      )
    })

    const fanChips = fanValues(scoringRules).map((fanValue) => {
      const selected = winState.fan === fanValue
      return (
        <button
          key={fanValue}
          type="button"
          className={`fan-chip${selected ? ' selected' : ''}`}
          aria-pressed={selected}
          onClick={() => setFan(tableId, fanValue)}
        >
          {fanLabel(fanValue, scoringRules)}
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
        <div id={`win-panel-title-${tableId}`} className="win-panel-title">👑 Select Winner</div>
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
                aria-pressed={selfSelected}
                onClick={() => setWinType(tableId, 'self')}
              >
                🀄 Self-draw<br />
                <small style={{ fontWeight: 400, fontSize: 9 }}>自摸</small>
              </button>
              <button
                type="button"
                className={`win-type-btn${discardSelected ? ' selected' : ''}`}
                aria-pressed={discardSelected}
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
                  <span>Fan ({scoringRules.minFan}–{scoringRules.maxFan}+)</span>
                  {winState.fan ? <span style={{ color: 'var(--purple)', fontWeight: 700 }}>{basePointsForFan(winState.fan, scoringRules)} pts base</span> : null}
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
    if (source !== 'sideline') setSidelineCollapsed(false)
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
      const isCurrentUserTable = tableId === currentUserTableId
      const isCollapsed = Boolean(collapsedTables[tableId])
      const visible = filteredTableCards.find((item) => item.tableId === tableId)?.visible ?? true
      if (!visible) return null
      const visiblePosition = visibleTableIds.indexOf(tableId) + 1

      return (
        <div
          key={tableId}
          className={`table-card${isValid ? ' valid' : ''}${isCurrentUserTable ? ' is-current-user-table' : ''}${tableId === activeTableId ? ' is-active-table' : ''}${isCollapsed ? ' is-collapsed' : ''}`}
          id={`table-${tableId}`}
          role="listitem"
          aria-label={`${tableName}, ${visiblePosition} of ${visibleTableIds.length}, ${playersOnTable.length} of 4 seats filled${isCurrentUserTable ? ', your table' : ''}`}
          data-table-id={tableId}
        >
          {playersOnTable.length > 0 ? (
            <button className="clear-table-btn" type="button" onClick={() => clearSingleTable(tableId)} aria-label={`Clear ${tableName}`}>✕</button>
          ) : null}
          <div className="table-header">
            <div className="table-title-block">
              <div className="table-title-line">
                <button
                  type="button"
                  className="table-name"
                  onClick={() => toggleTable(tableId)}
                  aria-expanded={!isCollapsed}
                  aria-controls={`tableBody-${tableId}`}
                >
                  {tableName}
                </button>
                {isCurrentUserTable ? <span className="table-you-badge">Your table</span> : null}
              </div>
              {isCollapsed ? (
                <span className="table-player-preview">
                  {playersOnTable.length > 0
                    ? playersOnTable.map((playerId) => `${playerInfo(playerId).icon ?? ''} ${shortName(playerInfo(playerId).displayName)}`).join(' · ')
                    : 'Empty table'}
                </span>
              ) : null}
            </div>
            <span className={`table-status ${isValid ? 'valid' : 'waiting'}`}>
              {isValid ? '✓ Ready' : `${playersOnTable.length}/4`}
            </span>
            <Link href={`/club/${encodeURIComponent(clubId)}/table/${tableId}`} className="table-focus-link" aria-label={`Open Table ${tableId} in focused view`} title="Open focused table">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ display: 'block' }}
              >
                <line x1="7" y1="17" x2="17" y2="7"></line>
                <polyline points="7 7 17 7 17 17"></polyline>
              </svg>
            </Link>
            <button
              type="button"
              id={`tableChevron-${tableId}`}
              onClick={() => toggleTable(tableId)}
              aria-label={isCollapsed ? `Expand ${tableName}` : `Collapse ${tableName}`}
              style={{ fontSize: 10, color: 'var(--gray)', background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}
            >
              {collapsedTables[tableId] ? '▼' : '▲'}
            </button>
          </div>
          <div id={`tableBody-${tableId}`} style={{ display: isCollapsed ? 'none' : undefined }}>
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
                        <button className="chip-remove-btn" type="button" onClick={() => removeToSideline(tableId, playerId)} title="Remove" aria-label={`Move ${info.displayName} to the sideline`}>
                          ×
                        </button>
                        <div className="chip-icon">{info.icon ?? '👤'}</div>
                        <div className="chip-name" title={info.displayName}>{shortName(info.displayName)}</div>
                        <button className="chip-win-btn" type="button" onClick={() => setWinner(tableId, playerId)} title="Won!" aria-label={`Record ${info.displayName} as the winner`}>
                          👑
                        </button>
                        <button className="chip-swap-btn" type="button" onClick={() => openSwapPicker(tableId, playerId)} title="Swap" aria-label={`Swap ${info.displayName} with another player`}>
                          ⇄
                        </button>
                      </div>
                    </div>
                  )
                }

                return (
                  <button
                    key={seatIndex}
                    type="button"
                    className="seat-slot"
                    id={`seat-${tableId}-${seatIndex}`}
                    onDragOver={(event) => handleDragOver(event, 'table')}
                    onDragLeave={(event) => handleDragLeave(event, 'table')}
                    onDrop={(event) => handleDrop(event, 'table', tableId)}
                    onClick={() => openPicker(tableId)}
                    aria-label={`Add a player to seat ${seatIndex + 1} at ${tableName}`}
                  >
                    <span className="empty-seat-hint">+ Add</span>
                  </button>
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
              ? createPortal(<div className="win-panel active session-result-dialog" id={`winPanel-${tableId}`} role="dialog" aria-modal="true" aria-labelledby={`win-panel-title-${tableId}`}>{renderWinPanel(tableId)}</div>, document.body)
              : <div className="win-panel" id={`winPanel-${tableId}`} />}
          </div>
        </div>
      )
    })
  }

  const sessionPlayersCount = session.participants.length
  const sessionTableCount = session.tableCount

  return (
    <div data-tour="session-manager" className="session-manager view-card">
      <style jsx global>{`

        .session-manager,
        .session-result-dialog,
        #pickerOverlay,
        #swapPickerOverlay {
          --purple: rgb(var(--bamboo));
          --purple-dark: rgb(var(--bamboo-bright));
          --green: rgb(var(--bamboo));
          --green-dark: rgb(var(--bamboo-bright));
          --red: rgb(var(--cinnabar));
          --red-dark: rgb(var(--cinnabar));
          --session-gold: rgb(var(--gold));
          --gray: rgb(var(--muted));
          --border: rgb(var(--line));
          --white: rgb(var(--surface));
          --card-bg: rgb(var(--surface));
          --radius: 4px;
        }

        .header { z-index: 1; }
        .header-actions { display: flex; gap: 6px; }
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
          display: flex; align-items: center; gap: 8px;
          padding: 8px 10px 6px;
          border-bottom: 1px solid #f0f0f0;
        }
        .table-name {
          font-size: 12px; font-weight: 700;
          color: #0f172a; flex: 1;
          border: 0; background: transparent; padding: 0;
          text-align: left; cursor: pointer;
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
          outline: 2px solid var(--session-gold);
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
          animation: app-spinner-turn var(--app-spinner-duration, 1.7s) infinite;
          margin-bottom: 10px;
        }

        .divider { height: 1px; background: var(--border); margin: 10px 0; }
        .error-msg { background: #fff5f5; color: #c53030; border-radius: 6px; padding: 8px 10px; font-size: 11px; margin-top: 6px; display: none; }

        .session-action-icon { width:18px; height:18px; flex:0 0 18px; }

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
          background: var(--session-gold);
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
          z-index: 2;
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
        .table-focus-link {
          display: flex;
          width: 26px;
          height: 26px;
          align-items: center;
          justify-content: center;
          border: 1px solid rgb(var(--line));
          border-radius: 6px;
          color: rgb(var(--muted));
          text-decoration: none;
          opacity: .45;
          transition: opacity 0.15s, background 0.15s, border-color 0.15s, color 0.15s;
        }
        .table-card:hover .table-focus-link, .table-focus-link:focus-visible {
          opacity: 1;
          background: rgb(var(--surface));
          color: rgb(var(--ink));
          border-color: rgb(var(--muted) / 0.5);
        }
        @media (max-width: 767px) {
          .table-focus-link {
            opacity: 1;
            min-width: 32px;
            min-height: 32px;
            border-radius: 6px;
            background: rgb(var(--surface-2));
            border-color: rgb(var(--line));
            color: rgb(var(--muted));
          }
          .table-focus-link:active {
            background: rgb(var(--surface));
            color: rgb(var(--ink));
            border-color: rgb(var(--muted) / 0.3);
          }
        }
        .clear-table-btn:hover {
          background: #fed7d7;
          color: #c53030;
          transform: scale(1.08);
        }
        /* Clubhouse session system */
        .session-manager { box-sizing:border-box; width:100%; max-width:100%; min-width:0; color:rgb(var(--ink)); overflow:hidden; border:1px solid rgb(var(--line)); border-radius:8px; background:rgb(var(--surface)); box-shadow:0 1px 2px rgb(var(--shadow)/.08); }
        .session-manager .header { position:relative; top:auto; }
        .session-manager #sessionPage { height:min(720px,calc(100vh - 128px)); background:transparent; }
        .session-manager .tables-scroll { padding:14px; background:transparent; }
        .session-manager input[type=text],.session-manager input[type=number] { border:1px solid rgb(var(--line))!important; border-radius:3px!important; background:rgb(var(--surface))!important; color:rgb(var(--ink))!important; box-shadow:inset 3px 0 0 rgb(var(--bamboo)); outline:none; }
        .session-manager input:focus { border-color:rgb(var(--bamboo))!important; box-shadow:inset 3px 0 0 rgb(var(--cinnabar)),0 0 0 2px rgb(var(--bamboo)/.12); }
        .session-manager .sideline-section { order:1; margin:12px 12px 0; padding:12px; border:1px solid rgb(var(--line)); border-left:4px solid var(--session-gold); border-radius:3px; background:rgb(var(--surface-2)); box-shadow:none; }
        .session-manager .section-label { margin:0 0 10px; color:rgb(var(--ink)); font-size:10px; letter-spacing:.16em; }
        .session-manager .section-label .badge { border:1px solid rgb(var(--gold)/.32); border-radius:2px; padding:1px 7px; background:rgb(var(--gold)/.12); color:rgb(var(--muted)); }
        .session-manager .sideline-area { min-height:74px; padding:10px; gap:12px; border:1px dashed rgb(var(--line)); border-radius:2px; background:rgb(var(--surface)); }
        .session-manager .table-card { border:1px solid rgb(var(--line)); border-left:4px solid rgb(var(--muted)); border-radius:3px; background:rgb(var(--surface)); box-shadow:4px 4px 0 rgb(var(--shadow)/.06); overflow:visible; }
        .session-manager .table-card.valid { border-color:rgb(var(--line)); border-left-color:rgb(var(--bamboo)); box-shadow:4px 4px 0 rgb(var(--bamboo)/.12); }
        .session-manager .table-card.drag-over { border-color:rgb(var(--cinnabar)); background:rgb(var(--cinnabar)/.04); }
        .session-manager .table-header { min-height:46px; padding:10px 12px; border-bottom:1px solid rgb(var(--line)); background:rgb(var(--surface-2)); }
        .session-manager .table-name { font-family:var(--font-sans),sans-serif; font-size:17px; color:rgb(var(--ink)); }
        .session-manager .table-status { border-radius:2px; padding:4px 8px; text-transform:uppercase; letter-spacing:.08em; }
        .session-manager .table-status.valid { background:rgb(var(--bamboo)); color:rgb(var(--surface)); }
        .session-manager .table-status.waiting { background:rgb(var(--line)/.45); color:rgb(var(--muted)); }
        .session-manager .table-seats { gap:10px; padding:16px; min-height:160px; }
        .session-manager .seat-slot { min-height:80px; border:1px dashed rgb(var(--line)); border-radius:2px; background:rgb(var(--surface-2)/.55); }
        .session-manager .seat-slot.occupied { border:1px solid transparent; background:transparent; }
        .session-manager .player-chip { width:72px; }
        .session-manager .chip-icon { width:52px; height:62px; border-radius:4px; border:1px solid rgb(var(--line)); background:linear-gradient(145deg,rgb(var(--surface)),rgb(var(--surface-2))); color:rgb(var(--ink)); box-shadow:2px 3px 0 rgb(var(--shadow)/.08); font-size:24px; }
        .session-manager .seat-slot .chip-icon { width:46px; height:56px; border-radius:4px; font-size:22px; }
        .session-manager .chip-name,.session-manager .player-toggle .name { color:rgb(var(--ink)); font-size:11px; margin-top:6px; font-weight:700; }
        .session-manager .player-chip:hover .chip-icon { border-color:rgb(var(--cinnabar)); transform:translateY(-1px); }
        .session-manager .table-actions { padding:12px 14px 14px; gap:10px; border-top:1px solid rgb(var(--line)); }
        .session-manager .btn-draw,.session-manager .btn-secondary,.session-manager .btn-cancel-win { border:1px solid rgb(var(--line)); border-radius:3px; background:rgb(var(--surface-2)); color:rgb(var(--ink)); }
        .session-manager .btn-draw:hover { border-color:var(--session-gold); background:rgb(var(--gold)/.1); color:rgb(var(--ink)); }
        .session-manager .btn-primary,.session-manager .btn-submit-game { border-radius:3px; background:rgb(var(--bamboo)); color:rgb(var(--surface)); box-shadow:2px 2px 0 rgb(var(--shadow)/.12); }
        .session-manager .setup-card { border-radius:3px; border-color:rgb(var(--line)); background:rgb(var(--surface)); box-shadow:3px 3px 0 rgb(var(--shadow)/.05); }
        .session-manager .setup-card h3 { color:rgb(var(--ink)); letter-spacing:.14em; }
        .session-manager .player-toggle { border:1px solid rgb(var(--line)); border-radius:3px; background:rgb(var(--surface-2)); }
        .session-manager .player-toggle.selected { border-color:rgb(var(--bamboo)); background:rgb(var(--bamboo)/.1); box-shadow:inset 0 -3px 0 rgb(var(--bamboo)); }
        .session-manager .win-panel { border-top-color:var(--session-gold); background:rgb(var(--gold)/.09); color:rgb(var(--ink)); padding:12px; }
        .session-manager .win-panel-title { color:rgb(var(--cinnabar)); font-size:13px; font-weight:800; }
        .session-manager .loser-label, .session-manager .fan-label { color:rgb(var(--ink)); font-size:13px; font-weight:800; }
        .session-manager .win-type-btn, .session-manager .loser-chip, .session-manager .fan-chip { border-color:rgb(var(--line)); border-radius:3px; background:rgb(var(--surface)); color:rgb(var(--ink)); font-size:13px; padding:6px 12px; }
        .session-manager .fan-chip { padding:6px 10px; }
        .session-manager .win-type-btn { padding:8px 6px; }
        .session-manager .win-type-btn.selected,.session-manager .fan-chip.selected { border-color:rgb(var(--bamboo)); background:rgb(var(--bamboo)/.1); color:rgb(var(--bamboo)); }
        .session-manager .score-preview { border-radius:3px; background:rgb(var(--ink)); }
        .session-manager .winner-choice.selected,.session-manager .winner-selected { border-color:rgb(var(--bamboo))!important; background:rgb(var(--bamboo))!important; color:#fff!important; box-shadow:0 0 0 2px rgb(var(--bamboo)/.25)!important; }
        .session-manager .discard-choice.selected,.session-manager .discard-selected { border-color:rgb(var(--cinnabar))!important; background:rgb(var(--cinnabar))!important; color:#fff!important; box-shadow:0 0 0 2px rgb(var(--cinnabar)/.22)!important; }
        .session-manager #pickerOverlay,.session-manager #swapPickerOverlay { position:fixed!important; inset:0!important; top:0!important; align-items:center!important; justify-content:center!important; overscroll-behavior:contain; }
        .session-manager .btn-submit-game, .session-manager .btn-cancel-win { font-size:14px; padding:10px 14px; }
        .session-manager .score-preview-name { font-size:12px; }
        .session-manager .score-preview-val { font-size:15px; }
        .session-manager .spinner { border-color:rgb(var(--line)); border-top-color:rgb(var(--cinnabar)); }
        .session-table-locator { margin:0 0 12px; padding:10px; border:1px solid rgb(var(--line)); border-radius:7px; background:rgb(var(--surface-2)/.72); }
        .session-table-locator.is-single-table { display:none; }
        .session-table-locator-heading { display:flex; align-items:center; justify-content:flex-end; padding:1px 1px 7px; }
        .session-my-table-button { display:inline-flex; min-height:36px; flex:0 0 auto; align-items:center; gap:6px; border:1px solid rgb(var(--bamboo)/.4); border-radius:5px; background:rgb(var(--bamboo)/.1); padding:6px 9px; color:rgb(var(--bamboo)); font-size:10px; font-weight:800; cursor:pointer; }
        .session-my-table-button:hover,.session-my-table-button:focus-visible { border-color:rgb(var(--bamboo)); background:rgb(var(--bamboo)); color:#fff; }
        .session-my-table-button span { display:grid; min-width:18px; min-height:18px; place-items:center; border-radius:50%; background:currentColor; color:rgb(var(--surface)); }
        .session-table-jump-row { display:block; }
        .session-mobile-table-toolbar { display:none; }
        .session-table-jumps { display:flex; gap:5px; overflow-x:auto; padding:8px 0 6px; scrollbar-width:none; scroll-snap-type:x proximity; }
        .session-table-jumps::-webkit-scrollbar { display:none; }
        .session-table-jump { display:grid; min-width:42px; min-height:40px; flex:0 0 auto; place-items:center; gap:1px; scroll-snap-align:start; border:1px solid rgb(var(--line)); border-radius:5px; background:rgb(var(--surface)); color:rgb(var(--ink)); cursor:pointer; }
        .session-table-jump:hover,.session-table-jump:focus-visible { border-color:rgb(var(--bamboo)); background:rgb(var(--bamboo)/.08); }
        .session-table-jump.is-active:not(.is-current) { border-color:rgb(var(--cinnabar)); box-shadow:inset 0 -2px 0 rgb(var(--cinnabar)); }
        .session-table-jump.is-current { border-color:rgb(var(--bamboo)); background:rgb(var(--bamboo)); color:#fff; box-shadow:0 2px 0 rgb(var(--shadow)/.14); }
        .session-table-jump.is-current.is-active { box-shadow:0 0 0 2px rgb(var(--cinnabar)/.55),0 2px 0 rgb(var(--shadow)/.14); }
        .session-table-jump strong { font-size:13px; line-height:1; }
        .session-table-jump small { color:inherit; font-size:8px; line-height:1; opacity:.78; }
        .session-table-search { display:flex; min-height:38px; align-items:center; gap:6px; border:1px solid rgb(var(--line)); border-radius:5px; background:rgb(var(--surface)); padding:0 8px; color:rgb(var(--muted)); }
        .session-table-search:focus-within { border-color:rgb(var(--bamboo)); box-shadow:0 0 0 2px rgb(var(--bamboo)/.1); }
        .session-table-search svg { width:15px; height:15px; flex:0 0 auto; }
        .session-manager .session-table-search input[type=search] { min-width:0; width:100%; border:0!important; border-radius:0!important; background:transparent!important; padding:8px 2px!important; color:rgb(var(--ink)); box-shadow:none!important; outline:0; }
        .session-table-search button { display:grid; min-width:30px; min-height:30px; place-items:center; border:0; border-radius:4px; background:transparent; color:rgb(var(--muted)); cursor:pointer; }
        .session-table-search button:hover { background:rgb(var(--line)/.5); color:rgb(var(--ink)); }
        .session-table-result-count { display:block; margin-top:5px; color:rgb(var(--muted)); font-size:9px; text-align:right; }
        .session-table-search-row { display:block; }
        .session-mobile-table-controls,.session-mobile-add-player { display:none; }
        .session-mobile-table-control,.session-mobile-add-player { align-items:center; justify-content:center; border:1px solid rgb(var(--line)); border-radius:5px; background:rgb(var(--surface)); color:rgb(var(--ink)); cursor:pointer; touch-action:manipulation; }
        .session-mobile-table-control svg,.session-mobile-add-player svg { width:18px; height:18px; }
        .session-mobile-table-control:disabled { cursor:not-allowed; opacity:.42; }
        .session-mobile-table-control:not(:disabled):hover,.session-mobile-table-control:not(:disabled):focus-visible,.session-mobile-add-player:hover,.session-mobile-add-player:focus-visible { border-color:rgb(var(--bamboo)); background:rgb(var(--bamboo)/.1); color:rgb(var(--bamboo)); }
        .session-mobile-table-count { display:grid; min-width:52px; min-height:42px; place-content:center; gap:4px; color:rgb(var(--ink)); text-align:center; font-variant-numeric:tabular-nums; }
        .session-mobile-table-count strong { font-size:12px; font-weight:900; line-height:1; }
        .session-mobile-table-count small { color:rgb(var(--muted)); font-size:7px; font-weight:750; line-height:1; white-space:nowrap; }
        .table-title-block { min-width:0; flex:1; }
        .table-title-line { display:flex; min-width:0; align-items:center; gap:7px; }
        .session-manager .table-title-line .table-name { min-height:0; flex:0 1 auto; }
        .table-you-badge { flex:0 0 auto; border:1px solid rgb(var(--bamboo)/.35); border-radius:999px; background:rgb(var(--bamboo)/.1); padding:2px 6px; color:rgb(var(--bamboo)); font-size:8px; font-weight:850; letter-spacing:.06em; text-transform:uppercase; }
        .table-player-preview { display:block; margin-top:3px; overflow:hidden; color:rgb(var(--muted)); font-size:9px; text-overflow:ellipsis; white-space:nowrap; }
        .session-manager .table-card.is-current-user-table { border-color:rgb(var(--bamboo)); box-shadow:0 0 0 2px rgb(var(--bamboo)/.12),4px 4px 0 rgb(var(--bamboo)/.1); }
        .session-manager .table-card.is-collapsed { margin-bottom:8px; box-shadow:2px 2px 0 rgb(var(--shadow)/.04); }
        .session-manager .table-card.is-collapsed .table-header { min-height:52px; border-bottom:0; }
        .session-manager .sideline-section { margin:10px 12px 0; padding:0; border:1px solid rgb(var(--line)); border-left:1px solid rgb(var(--line)); border-radius:6px; background:rgb(var(--surface-2)/.58); }
        .session-manager .sideline-section.is-collapsed { background:rgb(var(--surface)/.56); }
        .session-manager .sideline-toggle { min-height:40px; margin:0; padding:7px 10px; gap:6px; color:rgb(var(--muted)); font-size:0; }
        .session-manager .sideline-label { color:rgb(var(--ink)); font-family:var(--font-sans),sans-serif; font-size:11px; font-weight:850; letter-spacing:0; text-transform:none; }
        .session-manager .sideline-helper { min-width:0; overflow:hidden; color:rgb(var(--muted)); font-family:var(--font-sans),sans-serif; font-size:9px; font-weight:500; letter-spacing:0; text-overflow:ellipsis; text-transform:none; white-space:nowrap; }
        .session-manager #sidelineChevron { margin-left:auto; color:rgb(var(--muted)); font-size:9px; }
        .session-manager .sideline-body { padding:0 8px 8px; }
        .session-manager .sideline-area { min-height:62px; padding:8px; gap:8px; }
        html.dark .session-manager .header,html.dark .session-manager .table-name,html.dark .session-manager .chip-name,html.dark .session-manager .section-label,html.dark .session-manager .setup-card h3 { color:rgb(var(--ink))!important; }
        @media(max-width:767px){
          .session-manager #sessionPage{height:calc(100dvh - 112px)}
          .session-manager .tables-scroll{padding:8px}
          .session-manager .sideline-section{display:none!important}
          .session-table-locator{margin-bottom:8px;padding:8px}
          .session-table-locator.is-single-table{display:block}
          .session-table-locator-heading{padding:0 2px 8px}
          .session-my-table-button{min-height:44px;padding:7px 9px}
          .session-table-jump-row{display:flex;min-width:0;align-items:center;gap:8px;overflow:hidden;padding-bottom:8px}
          .session-mobile-table-toolbar{position:relative;z-index:1;display:flex;min-height:44px;flex:0 0 auto;align-items:center;padding:0;background:rgb(var(--surface-2)/.72)}
          .session-table-jumps{position:relative;z-index:0;box-sizing:border-box;width:auto;min-width:0;max-width:100%;flex:1 1 auto;overflow-x:auto;overflow-y:hidden;overscroll-behavior-inline:contain;padding:0 2px;scroll-padding-inline:2px 10px;scroll-snap-type:x proximity;touch-action:pan-y pinch-zoom;-webkit-overflow-scrolling:touch;cursor:grab;user-select:none}
          .session-table-jumps:active{cursor:grabbing}
          .session-table-jumps::after{content:"";flex:0 0 8px}
          .session-table-jump{min-width:44px;min-height:44px;scroll-snap-align:start}
          .session-mobile-table-controls{display:flex;height:44px;flex:0 0 auto;overflow:hidden;align-items:center;border:1px solid rgb(var(--bamboo)/.38);border-radius:999px;background:rgb(var(--bamboo)/.08);box-shadow:inset 0 1px 0 rgb(255 255 255/.26)}
          .session-mobile-table-control{display:flex;min-width:44px;min-height:42px;padding:0;border:0;border-radius:0;background:transparent;color:rgb(var(--bamboo))}
          .session-mobile-table-control:first-child{border-right:1px solid rgb(var(--bamboo)/.22)}
          .session-mobile-table-control:last-child{border-left:1px solid rgb(var(--bamboo)/.22)}
          .session-table-search-row{display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:stretch;gap:6px}
          .session-table-search{min-height:44px}
          .session-table-search button{min-width:44px;min-height:44px}
          .session-mobile-add-player{display:inline-flex;min-height:44px;gap:6px;padding:0 10px;font-size:10px;font-weight:850;white-space:nowrap}
          .session-manager .tables-container{display:block;overflow:visible;padding:0}
          .session-manager .tables-container .table-card{scroll-margin-top:132px}
          .session-manager .table-card .clear-table-btn{top:5px;left:5px;min-width:44px!important;min-height:44px!important}
          .session-manager .table-card:has(.clear-table-btn) .table-header{padding-left:56px}
          .session-manager [id^=tableChevron-]{min-width:44px;min-height:44px;padding:8px!important;touch-action:manipulation}
          .session-manager .table-card.is-collapsed{margin-bottom:7px!important}
          .session-manager .table-card.is-collapsed .table-header{min-height:52px;padding:8px 10px}
          .session-manager .table-card.is-collapsed:has(.clear-table-btn) .table-header{padding-left:56px}
          .session-manager .sideline-toggle{min-height:44px}
          .desktop-table-count { display:none; }
          .mobile-table-stepper { display:flex; align-items:center; gap:10px; }
          .session-result-dialog { display:block!important; position:fixed!important; left:50%!important; top:calc(var(--visual-viewport-top,0px) + var(--visual-viewport-height,100dvh)/2)!important; transform:translate(-50%,-50%)!important; width:min(420px,calc(100vw - 24px))!important; max-height:calc(var(--visual-viewport-height,100dvh) - 24px)!important; overflow-y:auto!important; z-index:12000!important; padding:16px!important; border:1px solid rgb(var(--line))!important; border-radius:6px!important; background:rgb(var(--surface))!important; color:rgb(var(--ink))!important; box-shadow:0 0 0 100vmax rgb(0 0 0/.68),0 20px 60px rgb(0 0 0/.35)!important; overscroll-behavior:contain; }
        }
        @media(prefers-reduced-motion:reduce){
          .session-manager .table-card{transition:none!important}
        }
      `}</style>

      <ViewHeader
        className="header"
        title="Session"
        action={<div className="header-actions">
          <button
            ref={headerMenuTriggerRef}
            className="view-header-action"
            type="button"
            onClick={(event) => {
              if (headerMenuOpen) closeHeaderMenu(false)
              else openHeaderMenu(event.currentTarget)
            }}
            onKeyDown={(event) => {
              if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
              event.preventDefault()
              openHeaderMenu(event.currentTarget, event.key === 'ArrowUp' ? 'last' : 'first')
            }}
            id="btnMenu"
            aria-label="Session actions"
            title="Session actions"
            aria-haspopup={headerMenuMobile ? 'dialog' : 'menu'}
            aria-expanded={headerMenuOpen}
            aria-controls={headerMenuMobile ? 'headerMenuSurface' : 'headerMenu'}
            style={{ display: page === 'session' ? '' : 'none' }}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.5" />
              <circle cx="12" cy="12" r="1.5" />
              <circle cx="19" cy="12" r="1.5" />
            </svg>
          </button>
          {headerMenuOpen && typeof document !== 'undefined' ? createPortal(
            <div
              ref={headerMenuLayerRef}
              className="session-actions-layer"
              onPointerDown={(event) => {
                if (event.target === event.currentTarget) closeHeaderMenu(true)
              }}
            >
              <section
                ref={headerMenuSurfaceRef}
                id="headerMenuSurface"
                role={headerMenuMobile ? 'dialog' : undefined}
                aria-modal={headerMenuMobile ? true : undefined}
                aria-labelledby={headerMenuMobile ? 'session-actions-title' : undefined}
                className="session-actions-menu"
                style={{
                  position: 'fixed',
                  top: headerMenuAnchor.top,
                  bottom: headerMenuAnchor.bottom,
                  right: headerMenuAnchor.right,
                  maxHeight: headerMenuAnchor.maxHeight,
                  overflowX: 'hidden',
                  overflowY: 'auto',
                  zIndex: 30020,
                }}
              >
                <div className="session-actions-menu-header">
                  <strong id="session-actions-title">Session Actions</strong>
                  <button type="button" aria-label="Close session actions" onClick={() => closeHeaderMenu(true)}>×</button>
                </div>
                <div
                  id="headerMenu"
                  ref={headerMenuRef}
                  className="app-menu-list"
                  role={headerMenuMobile ? undefined : 'menu'}
                  aria-label={headerMenuMobile ? undefined : 'Session actions'}
                  onKeyDown={headerMenuMobile ? undefined : handleHeaderMenuKeyDown}
                >
                  <div className="app-menu-group" role={headerMenuMobile ? undefined : 'group'} aria-label="Session">
                    <button
                      data-session-action
                      type="button"
                      role={headerMenuMobile ? undefined : 'menuitem'}
                      tabIndex={headerMenuMobile ? 0 : -1}
                      className="app-menu-row"
                      onClick={() => {
                        setPage('setup')
                        closeHeaderMenu(false)
                        window.requestAnimationFrame(() => setupHeadingRef.current?.focus())
                      }}
                    >
                      <MenuGlyph name="edit" />
                      <span className="app-menu-row-copy"><strong>Edit Session…</strong></span>
                    </button>
                    {onAddPlayer ? (
                      <button type="button" role={headerMenuMobile ? undefined : 'menuitem'} tabIndex={headerMenuMobile ? 0 : -1} className="app-menu-row" onClick={openAddPlayerFlow}>
                        <MenuGlyph name="add-player" />
                        <span className="app-menu-row-copy"><strong>Add Player…</strong></span>
                      </button>
                    ) : null}
                  </div>

                  <div className="app-menu-group" role={headerMenuMobile ? undefined : 'group'} aria-label="Table QR tools">
                    <Link
                      href={`/club/${encodeURIComponent(clubId)}/session/qr-print`}
                      target="_blank"
                      rel="noopener noreferrer"
                      role={headerMenuMobile ? undefined : 'menuitem'}
                      tabIndex={headerMenuMobile ? 0 : -1}
                      onClick={() => closeHeaderMenu(false)}
                      className="app-menu-row"
                    >
                      <MenuGlyph name="qr" />
                      <span className="app-menu-row-copy"><strong>Print Table QR Codes</strong></span>
                    </Link>
                    {isManager ? (
                      <button
                        type="button"
                        role={headerMenuMobile ? 'switch' : 'menuitemcheckbox'}
                        tabIndex={headerMenuMobile ? 0 : -1}
                        aria-checked={qrAutoEnroll === true}
                        aria-busy={savingQrEnrollment}
                        aria-disabled={qrAutoEnroll === null || savingQrEnrollment}
                        onClick={() => void toggleQrEnrollment()}
                        className="app-menu-row"
                      >
                        <MenuGlyph name="auto-join" />
                        <span className="app-menu-row-copy"><strong>Automatic QR Enrollment</strong></span>
                        <span className="app-menu-trailing" aria-hidden="true">
                          {savingQrEnrollment ? 'Saving…' : qrAutoEnroll === null ? 'Unavailable' : qrAutoEnroll ? 'On' : 'Off'}
                          <span className="app-menu-check">✓</span>
                        </span>
                      </button>
                    ) : null}
                  </div>

                  <div className="app-menu-group" role={headerMenuMobile ? undefined : 'group'} aria-label="Table assignments">
                    <button
                      type="button"
                      role={headerMenuMobile ? undefined : 'menuitem'}
                      tabIndex={headerMenuMobile ? 0 : -1}
                      aria-label="Shuffle tables"
                      aria-describedby="session-shuffle-description"
                      onClick={() => { closeHeaderMenu(true); openTableShuffle() }}
                      className="app-menu-row"
                    >
                      <MenuGlyph name="shuffle" />
                      <span className="app-menu-row-copy">
                        <strong>Shuffle tables</strong>
                        <small id="session-shuffle-description">Preview and reseat full tables of 4</small>
                      </span>
                    </button>
                    <button
                      type="button"
                      role={headerMenuMobile ? undefined : 'menuitem'}
                      tabIndex={headerMenuMobile ? 0 : -1}
                      aria-label="Clear All Tables"
                      aria-describedby="session-clear-all-description"
                      onClick={() => { clearAllTables(); closeHeaderMenu(true) }}
                      className="app-menu-row"
                    >
                      <MenuGlyph name="clear-tables" />
                      <span className="app-menu-row-copy">
                        <strong>Clear All Tables</strong>
                        <small id="session-clear-all-description">Move every player to the sideline</small>
                      </span>
                    </button>
                  </div>

                  <div className="app-menu-group" role={headerMenuMobile ? undefined : 'group'} aria-label="Destructive actions">
                    <button
                      type="button"
                      role={headerMenuMobile ? undefined : 'menuitem'}
                      tabIndex={headerMenuMobile ? 0 : -1}
                      aria-label="Reset Session…"
                      aria-describedby="session-reset-description"
                      onClick={() => {
                        closeHeaderMenu(false)
                        void confirmClearSession().then((didReset) => {
                          if (!didReset) window.requestAnimationFrame(() => headerMenuTriggerRef.current?.focus())
                        })
                      }}
                      className="app-menu-row app-menu-danger"
                    >
                      <MenuGlyph name="reset" />
                      <span className="app-menu-row-copy">
                        <strong>Reset Session…</strong>
                        <small id="session-reset-description">End this session and clear participation</small>
                      </span>
                    </button>
                  </div>
                </div>
              </section>
            </div>,
            document.body,
          ) : null}
        </div>}
      />

      <div id="loadingScreen" className={`page ${page === 'loading' ? 'active' : ''}`}>
        <div className="loading-screen"><div className="spinner" />
          <span>Loading session...</span>
        </div>
      </div>

      <div id="setupPage" className={`page ${page === 'setup' ? 'active' : ''}`}>
        <div className="setup-card">
          <h3 ref={setupHeadingRef} tabIndex={-1}>📋 Number of Tables</h3>
          <div className="desktop-table-count">
            <input
              type="number"
              aria-label="Number of tables"
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
            aria-label="Search participating players"
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
                aria-pressed={setupParticipants.includes(player.id)}
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
          {setupError ? <div className="error-msg" role="alert" aria-live="assertive" style={{ display: 'block' }}>{setupError}</div> : null}
        </div>
      </div>

      <div id="sessionPage" className={`page ${page === 'session' ? 'active' : ''}`}>
        <div className="tables-scroll">
          {sessionTables.length > 0 ? <div className={`session-table-locator${sessionTables.length === 1 ? ' is-single-table' : ''}`} aria-label="Session table controls">
            {currentUserTableId ? (
              <div className="session-table-locator-heading">
                <button type="button" className="session-my-table-button" onClick={() => jumpToTable(currentUserTableId)}>
                  My table <span>{currentUserTableId}</span>
                </button>
              </div>
            ) : null}
            <div className="session-table-jump-row">
              <div
                className="session-table-jumps"
                aria-label="Choose a session table"
                data-workspace-swipe-ignore
                onPointerDown={beginTableJumpDrag}
                onPointerMove={moveTableJumpDrag}
                onPointerUp={endTableJumpDrag}
                onPointerCancel={endTableJumpDrag}
                onWheel={scrollTableJumpsWithWheel}
              >
                {sessionTables.map((playersOnTable, index) => {
                  const tableId = String(index + 1)
                  const isCurrent = tableId === currentUserTableId
                  const isActive = tableId === activeTableId
                  return (
                    <button
                      key={tableId}
                      type="button"
                      className={`session-table-jump${isCurrent ? ' is-current' : ''}${isActive ? ' is-active' : ''}`}
                      aria-label={`Jump to Table ${tableId}, ${playersOnTable.length} of 4 seats filled${isCurrent ? ', your table' : ''}`}
                      aria-current={isCurrent ? 'location' : undefined}
                      aria-pressed={isActive}
                      onClick={() => {
                        if (suppressTableJumpClickRef.current) return
                        jumpToTable(tableId)
                      }}
                    >
                      <strong>{tableId}</strong>
                      <small>{playersOnTable.length}/4</small>
                    </button>
                  )
                })}
              </div>
              <div className="session-mobile-table-toolbar">
                <div className="session-mobile-table-controls" role="group" aria-label="Change the number of session tables" data-workspace-swipe-ignore>
                  <button
                    type="button"
                    className="session-mobile-table-control"
                    aria-label="Remove the last table"
                    title="Remove table"
                    disabled={loading || !user || sessionTableCount <= MIN_SESSION_TABLES}
                    onClick={() => adjustActiveTableCount(-1)}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /></svg>
                  </button>
                  <output className="session-mobile-table-count" aria-live="polite" aria-label={`${sessionTableCount} session tables`}>
                    <strong>{sessionTableCount}</strong>
                    <small>Tables</small>
                  </output>
                  <button
                    type="button"
                    className="session-mobile-table-control"
                    aria-label="Add a table"
                    title="Add table"
                    disabled={loading || !user || sessionTableCount >= MAX_SESSION_TABLES}
                    onClick={() => adjustActiveTableCount(1)}
                  >
                    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </button>
                </div>
              </div>
            </div>
            <div className="session-table-search-row">
              <div className="session-table-search">
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></svg>
                <input
                  type="search"
                  aria-label="Search tables or players"
                  value={tableSearch}
                  onChange={(event) => setTableSearch(event.target.value)}
                  placeholder="Search table or player…"
                />
                {tableSearch ? <button type="button" onClick={() => setTableSearch('')} aria-label="Clear table search">×</button> : null}
              </div>
              {onAddPlayer ? (
                <button type="button" className="session-mobile-add-player" aria-label="Add a new player" onClick={openAddPlayerFlow} data-workspace-swipe-ignore>
                  <AddPlayerActionIcon />
                  <span>Add player</span>
                </button>
              ) : null}
            </div>
            {tableSearch ? <span className="session-table-result-count" role="status">{filteredTableCards.filter((table) => table.visible).length} table{filteredTableCards.filter((table) => table.visible).length === 1 ? '' : 's'} found</span> : null}
          </div> : null}
          <div
            className="tables-container"
            role="list"
            aria-label="Session tables"
          >
            {renderSessionTables()}
          </div>
        </div>

        <div className={`sideline-section${sidelineCollapsed ? ' is-collapsed' : ''}`}>
          <button
            type="button"
            className="section-label sideline-toggle"
            onClick={toggleSideline}
            aria-expanded={!sidelineCollapsed}
            aria-controls="sidelineBody"
            style={{ width: '100%', border: 0, background: 'transparent', textAlign: 'left', cursor: 'pointer' }}
          >
            <span className="sideline-label">Sideline</span>
            <span className="badge" id="sidelineCount">{sessionSideline.length}</span>
            <span className="sideline-helper">{sidelineCollapsed ? 'Show waiting players' : 'Drag players here or use table controls'}</span>
            <span id="sidelineChevron" style={{ marginLeft: 'auto', fontSize: 10, color: 'var(--gray)' }}>{sidelineCollapsed ? '▼' : '▲'}</span>
          </button>
          <div id="sidelineBody" className="sideline-body" style={{ display: sidelineCollapsed ? 'none' : 'block' }}>
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

      {toast ? <div className="toast active" role="status" aria-live="polite">{toast}</div> : null}
      <ScoreCelebration result={flash} player={playerInfo} />
      {pickerTableId && typeof document !== 'undefined' ? createPortal(<div id="pickerOverlay" role="dialog" aria-modal="true" aria-labelledby="add-player-title" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', zIndex: 20010, padding: 16, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'rgb(var(--surface))', color: 'rgb(var(--ink))', borderRadius: 14, overflow: 'hidden', width: '100%', maxWidth: 340, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div id="add-player-title" style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>Add Player to Table {pickerTableId}</div>
            <button type="button" onClick={closePicker} aria-label="Close player picker" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, color: 'white', fontSize: 18, width: 30, height: 30, cursor: 'pointer' }}>×</button>
          </div>
          <div className="picker-selected-summary" style={{ padding: '10px 12px', borderBottom: '1px solid rgb(var(--line))', background: 'rgb(var(--surface-2))' }}>
            <div style={{ marginBottom: 7, fontSize: 11, fontWeight: 800, color: 'rgb(var(--ink))', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Selected ({(session.tables[pickerTableId] || []).length}/4)</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(session.tables[pickerTableId] || []).length === 0 ? <span style={{ fontSize: 12, color: 'rgb(var(--muted))' }}>No players selected yet.</span> : (session.tables[pickerTableId] || []).map((playerId) => {
                const info = playerInfo(playerId)
                return <button key={playerId} type="button" onClick={() => removeToSideline(pickerTableId, playerId)} title={`Remove ${info.displayName} from this table`} style={{ display: 'inline-flex', minHeight: 36, alignItems: 'center', gap: 6, border: '1px solid rgb(var(--line))', borderRadius: 6, background: 'rgb(var(--surface))', padding: '5px 8px', color: 'rgb(var(--ink))', fontSize: 12, fontWeight: 700 }}><span>{info.icon}</span><span>{shortName(info.displayName)}</span><span aria-hidden="true">×</span></button>
              })}
            </div>
          </div>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid rgb(var(--line))' }}>
            <input
              type="text"
              aria-label="Search players on the sideline"
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
                  <div className="picker-player-name" style={{ fontSize: 9, fontWeight: 700, color: 'rgb(var(--ink))', marginTop: 4, textAlign: 'center', maxWidth: 56, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{shortName(info.displayName)}</div>
                </button>
              )
            })}
          </div>
          <div style={{ padding: '10px 12px', borderTop: '1px solid rgb(var(--line))', fontSize: 11, color: 'rgb(var(--muted))', textAlign: 'center' }} id="pickerEmpty">
            {pickerAvailable.length === 0 ? (pickerSearch ? 'No players match your search.' : 'No players on sideline.') : ''}
          </div>
        </div>
      </div>, document.body) : null}

      {swapPickerTableId && typeof document !== 'undefined' ? createPortal(<div id="swapPickerOverlay" role="dialog" aria-modal="true" aria-labelledby="swap-player-title" style={{ display: 'flex', position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.68)', zIndex: 20010, padding: 16, alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ background: 'white', borderRadius: 14, overflow: 'hidden', width: '100%', maxWidth: 340, maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
          <div style={{ background: 'linear-gradient(135deg,#667eea,#764ba2)', padding: '14px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <div id="swap-player-title" style={{ fontSize: 14, fontWeight: 800, color: 'white' }}>Swap {swapPickerPlayer ? shortName(playerInfo(swapPickerPlayer).displayName) : ''}</div>
              <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', marginTop: 1 }}>Select a player to swap with</div>
            </div>
            <button type="button" onClick={closeSwapPicker} aria-label="Close player swap" style={{ background: 'rgba(255,255,255,0.2)', border: 'none', borderRadius: 8, color: 'white', fontSize: 18, width: 30, height: 30, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: '10px 12px', borderBottom: '1px solid #e2e8f0' }}>
            <input
              type="text"
              aria-label="Search players to swap"
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
                    <div className="swap-player-name" style={{ fontSize: 12, fontWeight: 700, color: 'rgb(var(--ink))' }}>{info.displayName}</div>
                    <div style={{ fontSize: 10, fontWeight: 600, color: locationColor }}>{locationLabel}</div>
                  </div>
                  <div style={{ fontSize: 11, color: '#a0aec0' }}>⇄</div>
                </button>
              )
            })}
          </div>
        </div>
      </div>, document.body) : null}

      {shuffleOpen ? (
        <TableShuffleModal
          clubId={clubId}
          seasonNumber={seasonNumber}
          tables={session.tables}
          players={players}
          onClose={() => setShuffleOpen(false)}
          onConfirm={confirmTableShuffle}
        />
      ) : null}
    </div>
  )
}
