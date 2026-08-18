'use client'

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import GameLogsModal from '@/components/GameLogsModal'
import NetworkGraphModal from '@/components/NetworkGraphModal'
import { LeaderboardPanel } from '@/components/Leaderboard'
import SessionManager from '@/components/SessionManager'
import ScoringRulesSettings from '@/components/ScoringRulesSettings'
import TitleRulesSettings from '@/components/TitleRulesSettings'
import ActivitySettings from '@/components/ActivitySettings'
import ClubToolSidebar from '@/components/ClubToolSidebar'
import { useAuth } from '@/contexts/AuthContext'
import { useSound } from '@/contexts/SoundContext'
import {
  createPlayer,
  deleteClub,
  ensureConfig,
  ensureSeasons,
  removePlayer,
  rebuildClubStats,
  promoteManagerByEmail,
  resolveJoinRequest,
  setPlayerAuthLink,
  startNewSeason,
  startNewTournament,
  updatePlayerIcon,
  updatePlayerName,
  subscribeClub,
  subscribeClubMembers,
  subscribeJoinRequests,
  subscribePlayers,
  subscribePlayerStats,
  subscribeScoringRules,
  subscribeTitleRules,
  subscribeActivitySettings,
  subscribeAllCompetitionStats,
  subscribeSeasons
} from '@/lib/data'
import type { ClubDoc, ClubMembershipDoc, JoinRequestDoc, PlayerDoc, PlayerStatsDoc, SeasonDoc } from '@/lib/types'
import { randomUnusedPlayerEmoji, randomUnusedPlayerEmojiOptions } from '@/lib/players'
import { DEFAULT_SCORING_RULES, type ScoringRules } from '@/lib/scoring-rules'
import { DEFAULT_TITLE_RULES, type TitleRules } from '@/lib/title-rules'
import { DEFAULT_ACTIVITY_SETTINGS, type ActivitySettings as ActivitySettingsValue } from '@/lib/activity-settings'
import {
  allSessionWindow,
  buildCustomSessionWindow,
  hoursSessionWindow,
  todayDateInputValue,
  type SessionPointWindow,
  type SessionPointWindowHours,
} from '@/lib/session-point-window'

const DashboardContent = dynamic(() => import('@/components/DashboardContent'), {
  loading: () => <div className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface-1))] p-5 text-sm font-bold text-[rgb(var(--muted))]" role="status">Loading analytics…</div>,
})

const ANALYTICS_TIME_WINDOWS = [
  { label: 'Last 24 hours', value: '24' },
  { label: 'Last 48 hours', value: '48' },
  { label: 'Last 7 days', value: '168' },
  { label: 'All time', value: 'all' },
  { label: 'Custom dates', value: 'custom' },
]

const CLUB_SIDEBAR_PREFERENCE_KEY = 'club-tools-sidebar'

const CLUB_SUMMARY_DEFINITIONS = {
  players: {
    label: 'Players',
    title: 'What is a player?',
    body: 'A player is a roster entry used for sessions, scores, standings, and titles. A player can exist even when it is not connected to anyone’s account.',
  },
  linked: {
    label: 'Linked',
    title: 'What does linked mean?',
    body: 'A linked player is a roster player connected to a user account. That connection lets the person identify their own player and update their own name or emoji.',
  },
  users: {
    label: 'Users',
    title: 'What is a user?',
    body: 'A user is someone who has joined this club with an account. Users can open the club workspace; they do not need to be linked to a roster player.',
  },
} as const

export default function ClubWorkspace({ clubId, membership }: { clubId: string; membership: ClubMembershipDoc }) {
  const today = todayDateInputValue()
  const { user } = useAuth()
  const router = useRouter()
  const [club, setClub] = useState<ClubDoc | null>(null)
  const [members, setMembers] = useState<ClubMembershipDoc[]>([])
  const [joinRequests, setJoinRequests] = useState<JoinRequestDoc[]>([])
  const [players, setPlayers] = useState<PlayerDoc[]>([])
  const [playerStats, setPlayerStats] = useState<PlayerStatsDoc[]>([])
  const [playerStatsReady, setPlayerStatsReady] = useState(false)
  const [scoringRules, setScoringRules] = useState<ScoringRules>(DEFAULT_SCORING_RULES)
  const [titleRules, setTitleRules] = useState<TitleRules>(DEFAULT_TITLE_RULES)
  const [activitySettings, setActivitySettings] = useState<ActivitySettingsValue>(DEFAULT_ACTIVITY_SETTINGS)
  const [playerName, setPlayerName] = useState('')
  const [playerIcon, setPlayerIcon] = useState(() => randomUnusedPlayerEmoji(new Set()))
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [newPlayerEmojiChoices, setNewPlayerEmojiChoices] = useState<string[]>([])
  const [linkToMe, setLinkToMe] = useState(false)
  const [playerMessage, setPlayerMessage] = useState<string | null>(null)
  const [joiningAction, setJoiningAction] = useState<string | null>(null)
  const [joinRequestNotice, setJoinRequestNotice] = useState<{ message: string; error: boolean } | null>(null)
  const [seasonMessage, setSeasonMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [rosterSearch, setRosterSearch] = useState('')
  const [scrollToAddPlayer, setScrollToAddPlayer] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [analyticsPlayerId, setAnalyticsPlayerId] = useState<string | null>(null)
  const [analyticsWindow, setAnalyticsWindow] = useState<SessionPointWindow>(() => allSessionWindow())
  const [analyticsStartDate, setAnalyticsStartDate] = useState(today)
  const [analyticsEndDate, setAnalyticsEndDate] = useState(today)
  const [analyticsWindowError, setAnalyticsWindowError] = useState<string | null>(null)
  const [gameLogsOpen, setGameLogsOpen] = useState(false)
  const [networkOpen, setNetworkOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [seasonControlsOpen, setSeasonControlsOpen] = useState(false)
  const [clubToolsExpanded, setClubToolsExpanded] = useState(false)
  const [summaryDefinition, setSummaryDefinition] = useState<keyof typeof CLUB_SUMMARY_DEFINITIONS | null>(null)
  const [seasons, setSeasons] = useState<SeasonDoc[]>([])
  const [viewedSeasonNumber, setViewedSeasonNumber] = useState<number | 'all' | null>(null)
  const [seasonAction, setSeasonAction] = useState<'season' | 'tournament' | null>(null)
  const [tournamentName, setTournamentName] = useState('')
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editingPlayerEmojiChoices, setEditingPlayerEmojiChoices] = useState<string[]>([])
  const [customEmojiValue, setCustomEmojiValue] = useState('')
  const [renamingPlayerId, setRenamingPlayerId] = useState<string | null>(null)
  const [renamingPlayerValue, setRenamingPlayerValue] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deletingClub, setDeletingClub] = useState(false)
  const [mobileView, setMobileView] = useState<'session' | 'standings'>('session')
  const [managerEmail, setManagerEmail] = useState('')
  const [managerMessage, setManagerMessage] = useState<string | null>(null)
  const [promotingManager, setPromotingManager] = useState(false)
  const [linkingPlayerId, setLinkingPlayerId] = useState<string | null>(null)
  const addPlayerSectionRef = useRef<HTMLElement>(null)
  const clubDashboardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const desktop = window.matchMedia?.('(min-width: 768px)')
    if (!desktop) return
    const syncSidebarForViewport = () => {
      if (!desktop.matches) {
        setClubToolsExpanded(false)
        return
      }
      setClubToolsExpanded(window.localStorage.getItem(CLUB_SIDEBAR_PREFERENCE_KEY) !== 'collapsed')
    }
    syncSidebarForViewport()
    desktop.addEventListener?.('change', syncSidebarForViewport)
    return () => desktop.removeEventListener?.('change', syncSidebarForViewport)
  }, [])

  const changeClubToolsExpanded = (value: boolean) => {
    setClubToolsExpanded(value)
    if (window.matchMedia?.('(min-width: 768px)').matches) {
      window.localStorage.setItem(CLUB_SIDEBAR_PREFERENCE_KEY, value ? 'expanded' : 'collapsed')
    }
  }

  const isManager = membership.role === 'manager'
  const { play } = useSound()
  const usedIconKeys = new Set(players.map((player) => player.icon.trim().toLocaleLowerCase()))
  const latestSeasonNumber = seasons.length ? seasons[seasons.length - 1].seasonNumber : club?.activeSeasonNumber ?? 1
  const activeSeasonNumber = club?.activeSeasonNumber ?? latestSeasonNumber
  const viewingAllCompetitions = viewedSeasonNumber === 'all'
  const selectedSeasonNumber = viewingAllCompetitions ? undefined : viewedSeasonNumber ?? activeSeasonNumber
  const seasonSelectValue = viewingAllCompetitions ? 'all' : String(selectedSeasonNumber)
  const activeCompetition = seasons.find((season) => season.seasonNumber === activeSeasonNumber) ?? null
  const selectedCompetition = seasons.find((season) => season.seasonNumber === selectedSeasonNumber) ?? null
  const viewingHistoricalCompetition = viewingAllCompetitions || selectedSeasonNumber !== activeSeasonNumber
  const nextTournamentNumber = seasons.filter((season) => season.kind === 'tournament').length + 1
  const linkedPlayerForUser = user ? players.find((player) => player.authUid === user.uid) ?? null : null
  const analyticsWindowValue = analyticsWindow.mode === 'all'
    ? 'all'
    : analyticsWindow.mode === 'range'
      ? 'custom'
      : String(analyticsWindow.hours)
  const normalizedRosterSearch = rosterSearch.trim().toLocaleLowerCase()
  const filteredRosterPlayers = normalizedRosterSearch
    ? players.filter((player) => player.displayName.toLocaleLowerCase().includes(normalizedRosterSearch))
    : players
  const clubModalOpen = summaryDefinition !== null || rosterOpen || analyticsOpen || gameLogsOpen || networkOpen || settingsOpen || deleteConfirmOpen

  useEffect(() => {
    clubDashboardRef.current?.toggleAttribute('inert', clubModalOpen)
  }, [clubModalOpen])

  const closeEmojiPickers = () => {
    setIconPickerOpen(false)
    setEditingPlayerId(null)
    setEditingPlayerEmojiChoices([])
    setCustomEmojiValue('')
  }

  const closeRoster = () => {
    closeEmojiPickers()
    setRosterSearch('')
    setScrollToAddPlayer(false)
    setRosterOpen(false)
  }

  const openRoster = (showAddPlayer = false) => {
    setPlayerMessage(null)
    setRosterOpen(true)
    setScrollToAddPlayer(showAddPlayer)
  }

  useEffect(() => {
    if (!rosterOpen || !scrollToAddPlayer) return
    const frame = window.requestAnimationFrame(() => {
      addPlayerSectionRef.current?.scrollIntoView?.({ block: 'start' })
      setScrollToAddPlayer(false)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [rosterOpen, scrollToAddPlayer])

  const openNewPlayerEmojiPicker = () => {
    setEditingPlayerId(null)
    setEditingPlayerEmojiChoices([])
    setNewPlayerEmojiChoices(randomUnusedPlayerEmojiOptions(usedIconKeys))
    setIconPickerOpen(true)
  }

  const togglePlayerEmojiPicker = (player: PlayerDoc, customValue = player.icon) => {
    setIconPickerOpen(false)
    setNewPlayerEmojiChoices([])
    if (editingPlayerId === player.id) {
      setEditingPlayerId(null)
      setEditingPlayerEmojiChoices([])
      setCustomEmojiValue('')
      return
    }
    setEditingPlayerEmojiChoices(randomUnusedPlayerEmojiOptions(usedIconKeys))
    setCustomEmojiValue(customValue)
    setEditingPlayerId(player.id)
  }

  const applyAnalyticsCustomRange = (startDate: string, endDate: string) => {
    try {
      setAnalyticsWindow(buildCustomSessionWindow(startDate, endDate))
      setAnalyticsWindowError(null)
    } catch (error) {
      setAnalyticsWindowError(error instanceof Error ? error.message : 'Choose a valid date range.')
    }
  }

  useEffect(() => subscribeClub(clubId, setClub), [clubId])
  useEffect(() => subscribeClubMembers(clubId, setMembers), [clubId])
  useEffect(() => subscribePlayers(clubId, setPlayers), [clubId])
  useEffect(() => {
    setPlayerStatsReady(false)
    const handleStats = (nextStats: PlayerStatsDoc[]) => {
      setPlayerStats(nextStats)
      setPlayerStatsReady(true)
    }
    if (viewingAllCompetitions) {
      return subscribeAllCompetitionStats(clubId, handleStats)
    }
    return subscribePlayerStats(
      clubId,
      handleStats,
      selectedSeasonNumber,
    )
  }, [clubId, selectedSeasonNumber, viewingAllCompetitions])
  useEffect(() => subscribeScoringRules(clubId, setScoringRules), [clubId])
  useEffect(() => subscribeTitleRules(clubId, setTitleRules), [clubId])
  useEffect(() => subscribeActivitySettings(clubId, setActivitySettings), [clubId])
  useEffect(() => subscribeSeasons(clubId, setSeasons), [clubId])
  useEffect(() => {
    if (!isManager || club?.universal) {
      setJoinRequests([])
      return
    }
    return subscribeJoinRequests(clubId, setJoinRequests)
  }, [club?.universal, clubId, isManager])

  useEffect(() => {
    ensureConfig(clubId).catch(() => undefined)
    ensureSeasons(clubId, user?.uid ?? 'system').catch(() => undefined)
  }, [clubId, user?.uid])

  useEffect(() => {
    if (clubId !== 'KEN' || !isManager || !user) return
    void rebuildClubStats(clubId).catch(() => undefined)
  }, [clubId, isManager, user])

  useEffect(() => {
    if (!joinRequestNotice) return
    const timer = window.setTimeout(() => setJoinRequestNotice(null), 2800)
    return () => window.clearTimeout(timer)
  }, [joinRequestNotice])

  useEffect(() => {
    if (!seasonMessage) return
    const timer = window.setTimeout(() => setSeasonMessage(null), 2200)
    return () => window.clearTimeout(timer)
  }, [seasonMessage])

  useEffect(() => {
    if (!rosterOpen || (!iconPickerOpen && editingPlayerId === null)) return

    const closeOnOutsidePointer = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('[data-emoji-picker-control]')) return
      closeEmojiPickers()
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeEmojiPickers()
    }

    document.addEventListener('pointerdown', closeOnOutsidePointer)
    document.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer)
      document.removeEventListener('keydown', closeOnEscape)
    }
  }, [editingPlayerId, iconPickerOpen, rosterOpen])

  const addPlayer = async () => {
    setPlayerMessage(null)
    if (!playerName.trim()) {
      play('error')
      setPlayerMessage('Enter a player name.')
      return
    }

    if (!playerIcon.trim()) {
      play('error')
      setPlayerMessage('Enter an emoji.')
      return
    }

    if (usedIconKeys.has(playerIcon.trim().toLocaleLowerCase())) {
      play('error')
      setPlayerMessage('That icon or initial is already in use in this club.')
      return
    }

    try {
      await createPlayer(clubId, {
        displayName: playerName,
        icon: playerIcon,
        authUid: linkToMe ? user?.uid ?? null : null
      })
      setPlayerName('')
      setPlayerIcon(randomUnusedPlayerEmoji(new Set(players.map((player) => player.icon.toLocaleLowerCase()))))
      setIconPickerOpen(false)
      setLinkToMe(false)
      setPlayerMessage('Player added.')
      play('confirmation')
    } catch (error) {
      play('error')
      setPlayerMessage(error instanceof Error ? error.message : 'Unable to add player.')
    }
  }

  const togglePlayerLink = async (player: PlayerDoc) => {
    if (!user) return
    setPlayerMessage(null)
    setLinkingPlayerId(player.id)
    try {
      await setPlayerAuthLink(clubId, player.id, user.uid, player.authUid !== user.uid)
      setPlayerMessage(player.authUid === user.uid ? `Unlinked from ${player.displayName}.` : `You are now linked to ${player.displayName}.`)
    } catch (error) {
      setPlayerMessage(error instanceof Error ? error.message : 'Unable to update player link.')
    } finally {
      setLinkingPlayerId(null)
    }
  }
  const changePlayerIcon = async (player: PlayerDoc, icon: string) => {
    setPlayerMessage(null)
    const nextIcon = icon.trim().slice(0, 12)
    if (!nextIcon) {
      setPlayerMessage('Enter an emoji.')
      return
    }
    try {
      await updatePlayerIcon(clubId, player.id, nextIcon)
      setEditingPlayerId(null)
      setCustomEmojiValue('')
      setPlayerMessage(`${player.displayName}'s emoji was updated.`)
    } catch (error) {
      setPlayerMessage(error instanceof Error ? error.message : 'Unable to update emoji.')
    }
  }
  const renamePlayer = async (player: PlayerDoc) => {
    const nextName = renamingPlayerValue.trim()
    if (!nextName) {
      setPlayerMessage('Enter a player name.')
      return
    }
    setPlayerMessage(null)
    try {
      await updatePlayerName(clubId, player.id, nextName)
      setRenamingPlayerId(null)
      setRenamingPlayerValue('')
      setPlayerMessage(`${player.displayName} was renamed to ${nextName}.`)
    } catch (error) {
      setPlayerMessage(error instanceof Error ? error.message : 'Unable to rename player.')
    }
  }
  const deleteRosterPlayer = async (player: PlayerDoc) => {
    if (!isManager || !window.confirm(`Remove ${player.displayName} from the roster? Their historical game records will remain.`)) return
    setPlayerMessage(null)
    try {
      await removePlayer(clubId, player.id)
      setPlayerMessage(`${player.displayName} was removed from the roster.`)
    } catch (error) {
      setPlayerMessage(error instanceof Error ? error.message : 'Unable to remove player.')
    }
  }

  const confirmDeleteClub = async () => {
    if (!user || !club || !isManager || club.universal || deleteConfirmName !== club.name) return
    setDeletingClub(true)
    try {
      await deleteClub(clubId)
      router.replace('/')
    } catch (error) {
      setPlayerMessage(error instanceof Error ? error.message : 'Unable to delete club.')
      setDeletingClub(false)
    }
  }
  const approveRequest = async (request: JoinRequestDoc, approved: boolean) => {
    if (!user || !club) return
    setJoiningAction(request.uid)
    setJoinRequests((current) => current.filter((item) => item.uid !== request.uid))
    setJoinRequestNotice({ message: approved ? 'Accepting join request…' : 'Declining join request…', error: false })
    try {
      await resolveJoinRequest({
        clubId,
        request,
        approved,
        managerUid: user.uid,
        clubName: club.name
      })
      setJoinRequestNotice({ message: approved ? 'Join request accepted.' : 'Join request declined.', error: false })
      play('confirmation')
    } catch (error) {
      setJoinRequests((current) => current.some((item) => item.uid === request.uid) ? current : [...current, request])
      setJoinRequestNotice({ message: error instanceof Error ? error.message : 'Unable to update the join request.', error: true })
      play('error')
    } finally {
      setJoiningAction(null)
    }
  }


  const promoteManager = async () => {
    if (!managerEmail.trim()) return
    setPromotingManager(true)
    setManagerMessage(null)
    try {
      const result = await promoteManagerByEmail(clubId, managerEmail)
      setManagerMessage(result.status === 'promoted'
        ? result.email + ' is now a club manager.'
        : 'A pending manager grant was saved for ' + result.email + '. It will apply when they first sign in.')
      setManagerEmail('')
      play('achievement')
    } catch (error) {
      play('error')
      setManagerMessage(error instanceof Error ? error.message : 'Unable to promote that manager.')
    } finally {
      setPromotingManager(false)
    }
  }
  const copyShare = async () => {
    await navigator.clipboard?.writeText(clubId)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1800)
  }

  const changeSeason = (value: string) => {
    if (value === 'all') {
      setViewedSeasonNumber('all')
      setSeasonMessage('Showing all seasons and tournaments combined.')
      setMobileView('standings')
      return
    }
    const seasonNumber = Number(value)
    const competition = seasons.find((season) => season.seasonNumber === seasonNumber)
    if (!seasonNumber || !competition) return
    setViewedSeasonNumber(seasonNumber === activeSeasonNumber ? null : seasonNumber)
    setSeasonMessage(seasonNumber === activeSeasonNumber
      ? `Showing current ${competition.name}.`
      : `Viewing ${competition.name} history.`)
  }

  const createNextSeason = async () => {
    if (!user) return
    if (!window.confirm('Start a new season? Current season data will remain available, and the active session will reset.')) return
    setSeasonAction('season')
    setSeasonMessage(null)
    try {
      await startNewSeason(clubId, { createdBy: user.uid })
      setViewedSeasonNumber(null)
      const regularSeasonNumber = seasons.filter((season) => season.kind !== 'tournament').length + 1
      setSeasonMessage(`Season ${regularSeasonNumber} started.`)
      setSettingsOpen(false)
    } catch (error) {
      setSeasonMessage(error instanceof Error ? error.message : 'Unable to start a new season.')
      play('error')
    } finally {
      setSeasonAction(null)
    }
  }

  const createTournament = async () => {
    if (!user) return
    const proposedName = tournamentName.trim() || `Tournament ${nextTournamentNumber}`
    if (!window.confirm(`Start ${proposedName}? The active session will reset, and its scores and stats will stay separate from regular seasons.`)) return
    setSeasonAction('tournament')
    setSeasonMessage(null)
    try {
      const tournament = await startNewTournament(clubId, {
        createdBy: user.uid,
        ...(tournamentName.trim() ? { name: tournamentName.trim() } : {}),
      })
      setViewedSeasonNumber(null)
      setTournamentName('')
      setSeasonMessage(`${tournament.name} started.`)
      setSettingsOpen(false)
    } catch (error) {
      setSeasonMessage(error instanceof Error ? error.message : 'Unable to start the tournament.')
      play('error')
    } finally {
      setSeasonAction(null)
    }
  }

  return (
    <main className="club-workspace-main px-4 py-6">
      <div className="club-workspace-shell" data-sidebar-expanded={clubToolsExpanded}>
        <ClubToolSidebar
          expanded={clubToolsExpanded}
          onExpandedChange={changeClubToolsExpanded}
          rosterOpen={rosterOpen}
          analyticsOpen={analyticsOpen}
          gameLogsOpen={gameLogsOpen}
          networkOpen={networkOpen}
          settingsOpen={settingsOpen}
          onRoster={() => openRoster()}
          onAnalytics={() => { setAnalyticsPlayerId(null); setAnalyticsOpen(true) }}
          onGameLogs={() => setGameLogsOpen(true)}
          onNetwork={() => setNetworkOpen(true)}
          onSettings={() => { setSeasonControlsOpen(false); setSettingsOpen(true) }}
        />
        <div className="club-workspace-content">
      <div data-tour="club-header" className="club-workspace-header mb-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="club-workspace-heading">
              <h1 className="break-words text-2xl font-black text-slate-950">{club?.name ?? membership.clubName}</h1>
              <div className="club-header-roster-summary" aria-label="Club roster summary">
                <button type="button" onClick={() => setSummaryDefinition('players')} aria-haspopup="dialog" aria-controls="club-summary-definition-dialog"><strong>{players.length}</strong><small>Players</small></button>
                <button type="button" onClick={() => setSummaryDefinition('linked')} aria-haspopup="dialog" aria-controls="club-summary-definition-dialog"><strong>{players.filter((player) => player.authUid).length}</strong><small>Linked</small></button>
                <button type="button" onClick={() => setSummaryDefinition('users')} aria-haspopup="dialog" aria-controls="club-summary-definition-dialog"><strong>{members.length}</strong><small>Users</small></button>
              </div>
        </div>
        <div className="club-context-actions flex min-w-0 shrink-0 flex-wrap items-center gap-2">
          <div className="contents">
          <label data-tour="season-selector" className="club-season-action flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Season</span>
            <select
              value={seasonSelectValue}
              onChange={(event) => changeSeason(event.target.value)}
              disabled={seasonAction !== null}
              className="bg-transparent text-sm font-black text-slate-900 outline-none disabled:opacity-50"
              aria-label="Season"
            >
              <option value="all">All seasons</option>
              {!viewingAllCompetitions && seasons.some((season) => season.seasonNumber === selectedSeasonNumber) ? null : !viewingAllCompetitions ? (
                <option value={selectedSeasonNumber}>Season {selectedSeasonNumber}</option>
              ) : null}
              {seasons.map((season) => (
                <option key={season.id} value={season.seasonNumber}>{season.name}{season.kind === 'tournament' ? ' · Tournament' : ''}{season.seasonNumber === activeSeasonNumber ? ' (current)' : ''}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={copyShare}
            className="club-id-action rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            {copied ? 'Copied' : `Club ID: ${clubId}`}
          </button>
          </div>
          {seasonMessage ? <span role="status" aria-live="polite" className="club-action-status flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{seasonMessage}</span> : null}
        </div>
      </div>

      {summaryDefinition ? (
        <div className="responsive-modal fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div id="club-summary-definition-dialog" role="dialog" aria-modal="true" aria-labelledby="club-summary-definition-title" className="responsive-modal-panel w-full max-w-sm rounded-lg border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-[rgb(var(--cinnabar))]">Club glossary</p>
                <h3 id="club-summary-definition-title" className="mt-2 text-xl font-black text-slate-950">{CLUB_SUMMARY_DEFINITIONS[summaryDefinition].title}</h3>
              </div>
              <button type="button" onClick={() => setSummaryDefinition(null)} className="min-h-10 rounded-lg border border-slate-300 px-3 text-sm font-bold text-slate-700" aria-label="Close definition">Close</button>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">{CLUB_SUMMARY_DEFINITIONS[summaryDefinition].body}</p>
          </div>
        </div>
      ) : null}

      {settingsOpen ? (
        <div className="responsive-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div id="club-settings-dialog" data-tour="settings-modal" role="dialog" aria-modal="true" aria-labelledby="club-settings-title" className="club-settings-dialog responsive-modal-panel flex max-h-[calc(100dvh-3rem)] min-h-0 w-full max-w-3xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
            <div className="club-settings-header shrink-0 border-b border-slate-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Club settings</p>
                  <h3 id="club-settings-title" className="mt-2 text-xl font-black text-slate-950">{club?.name ?? membership.clubName}</h3>
                  <p className="mt-1 text-sm text-slate-500">Manage competitions, scoring, standings, and club access.</p>
                </div>
                <button
                  data-tour="settings-close"
                  type="button"
                  onClick={() => setSettingsOpen(false)}
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="club-settings-body grid min-h-0 flex-1 gap-4 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <Link
                href="/"
                className="club-settings-home-link inline-flex min-h-11 items-center gap-2 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-4 py-3 text-sm font-black text-[rgb(var(--ink))] transition hover:border-[rgb(var(--bamboo))] hover:bg-[rgb(var(--bamboo)/.07)]"
              >
                <span aria-hidden="true">←</span> Back to homepage
              </Link>
              <section aria-labelledby="competition-settings-heading" className="club-settings-card rounded-xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="club-settings-kicker">Competition</p>
                    <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
                      <h4 id="competition-settings-heading" className="text-base font-black text-slate-900">Season controls</h4>
                      <p className="truncate text-xs font-semibold text-[rgb(var(--muted))]">
                        <span className="font-black uppercase tracking-[.08em]">Current:</span>{' '}
                        {activeCompetition?.name ?? `Season ${activeSeasonNumber}`} · {activeCompetition?.kind === 'tournament' ? 'Tournament' : 'Regular season'}
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    aria-expanded={seasonControlsOpen}
                    aria-controls="season-controls-content"
                    aria-label={seasonControlsOpen ? 'Collapse season controls' : 'Manage season controls'}
                    onClick={() => setSeasonControlsOpen((open) => !open)}
                    className="inline-flex min-h-10 w-full shrink-0 items-center justify-center gap-2 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-3 text-sm font-black text-[rgb(var(--ink))] transition hover:border-[rgb(var(--bamboo))] hover:bg-[rgb(var(--bamboo)/.07)] sm:w-auto"
                  >
                    {seasonControlsOpen ? 'Hide' : 'Manage'}
                    <svg aria-hidden="true" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" className={`h-4 w-4 transition-transform ${seasonControlsOpen ? 'rotate-180' : ''}`}><path d="m5 7.5 5 5 5-5" /></svg>
                  </button>
                </div>
                {seasonControlsOpen ? (
                  <div id="season-controls-content" className="mt-4 border-t border-slate-200 pt-4">
                    <p className="max-w-xl text-sm leading-6 text-slate-500">Seasons build regular club history. Tournaments use separate scores, ratings, and standings.</p>
                    {isManager ? (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="club-competition-choice rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-4">
                          <h5 className="text-sm font-black text-[rgb(var(--ink))]">Start a regular season</h5>
                          <p className="mt-1 text-xs leading-5 text-[rgb(var(--muted))]">Creates Season {seasons.filter((season) => season.kind !== 'tournament').length + 1} and resets the active table session.</p>
                          <button
                            type="button"
                            onClick={createNextSeason}
                            disabled={seasonAction !== null}
                            className="mt-4 min-h-11 w-full rounded-lg border border-[rgb(var(--bamboo))] bg-[rgb(var(--bamboo))] px-4 text-sm font-bold text-white transition hover:bg-[rgb(var(--bamboo-bright))] disabled:opacity-50"
                          >
                            {seasonAction === 'season' ? 'Starting season…' : 'Start new season'}
                          </button>
                        </div>
                        <div className="club-competition-choice club-competition-choice-tournament rounded-lg border border-[rgb(var(--gold)/.55)] bg-[rgb(var(--gold)/.07)] p-4">
                          <h5 className="text-sm font-black text-[rgb(var(--ink))]">Start a tournament</h5>
                          <p className="mt-1 text-xs leading-5 text-[rgb(var(--muted))]">Keeps tournament results separate from regular season totals.</p>
                          <label className="mt-3 block text-xs font-bold text-[rgb(var(--muted))]">
                            Tournament name <span className="font-normal">(optional)</span>
                            <input
                              value={tournamentName}
                              maxLength={80}
                              onChange={(event) => setTournamentName(event.target.value)}
                              placeholder={`Tournament ${nextTournamentNumber}`}
                              className="mt-1 min-h-11 w-full rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-3 text-[rgb(var(--ink))] outline-none"
                            />
                          </label>
                          <button
                            type="button"
                            onClick={createTournament}
                            disabled={seasonAction !== null}
                            className="mt-3 min-h-11 w-full rounded-lg border border-[rgb(var(--gold))] bg-[rgb(var(--gold)/.15)] px-4 text-sm font-black text-[rgb(var(--ink))] transition hover:bg-[rgb(var(--gold)/.25)] disabled:opacity-50"
                          >
                            {seasonAction === 'tournament' ? 'Starting tournament…' : 'Start tournament'}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
                        Only the club manager can start seasons or tournaments.
                      </p>
                    )}
                  </div>
                ) : null}
              </section>
              <div className="club-settings-group-heading">
                <p className="club-settings-kicker">Club rules</p>
                <p>Scoring, activity, and leaderboard titles apply across the club.</p>
              </div>
              <ScoringRulesSettings clubId={clubId} rules={scoringRules} isManager={isManager} />
              <ActivitySettings clubId={clubId} settings={activitySettings} isManager={isManager} />
              <TitleRulesSettings clubId={clubId} rules={titleRules} isManager={isManager} />
              <div className="club-settings-group-heading club-settings-danger-heading">
                <p className="club-settings-kicker">Club access</p>
                <p>Permanent club-level actions are kept separate from everyday settings.</p>
              </div>
              {isManager && !club?.universal ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-black text-rose-700">Delete club</p>
                  <p className="mt-1 text-sm text-rose-700">Permanently delete this club and all of its club-specific database records. This cannot be undone.</p>
                  <button type="button" onClick={() => setDeleteConfirmOpen(true)} aria-haspopup="dialog" aria-controls="delete-club-dialog" className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600">Delete club</button>
                </div>
              ) : isManager && club?.universal ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-black text-amber-900">Universal club protection</p>
                  <p className="mt-1 text-sm text-amber-800">The universal club is shared by everyone and cannot be deleted, including by its managers.</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmOpen && club && isManager && !club.universal ? (
        <div className="responsive-modal fixed inset-0 z-[60] flex items-center justify-center overflow-y-auto bg-slate-950/80 px-4 py-6">
          <div id="delete-club-dialog" role="dialog" aria-modal="true" aria-labelledby="delete-club-title" aria-describedby="delete-club-description" className="responsive-modal-panel modal-panel-scroll w-full max-w-md overflow-y-auto overscroll-contain rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">Permanent action</p>
            <h3 id="delete-club-title" className="mt-2 text-xl font-black text-slate-950">Delete {club.name}?</h3>
            <p id="delete-club-description" className="mt-2 text-sm leading-6 text-slate-600">
              This permanently deletes the club for every member, including its roster and player links, memberships and join requests, games and scores, statistics and rankings, seasons, sessions and table layouts, QR codes, settings, and club audit history. Your account and other clubs are not affected. This cannot be undone.
            </p>
            <p className="mt-3 text-sm font-bold leading-6 text-rose-700">Type <strong>{club.name}</strong> exactly to confirm.</p>
            <input value={deleteConfirmName} onChange={(event) => setDeleteConfirmName(event.target.value)} className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-rose-500" placeholder={club.name} />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmName('') }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Cancel</button>
              <button type="button" onClick={confirmDeleteClub} disabled={deleteConfirmName !== club.name || deletingClub} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{deletingClub ? 'Deleting...' : 'Delete club'}</button>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="mobile-workspace-tabs sticky top-0 z-30 mx-auto mb-4 grid w-full grid-cols-3 rounded-lg border border-slate-200 bg-white/95 p-2 backdrop-blur md:hidden" aria-label="Club workspace">
        <button
          data-tour="club-tools-toggle"
          type="button"
          aria-label="Open club tools"
          aria-expanded={clubToolsExpanded}
          aria-controls="club-tool-sidebar-panel"
          onClick={() => changeClubToolsExpanded(true)}
          className="mobile-workspace-tab inline-flex items-center justify-center gap-1.5"
        >
          <span aria-hidden="true" className="text-base leading-none">☰</span>
          <span>Tools</span>
        </button>
        {([
          ['session', 'Session'],
          ['standings', 'Leaderboard'],
        ] as const).map(([view, label]) => (
          <button
            key={view}
            data-tour={view === 'standings' ? 'standings-tab' : undefined}
            type="button"
            onClick={() => setMobileView(view)}
            aria-pressed={mobileView === view}
            className={mobileView === view ? 'mobile-workspace-tab active' : 'mobile-workspace-tab'}
          >
            {label}
          </button>
        ))}
      </nav>

      <div ref={clubDashboardRef} className={`club-workspace-dashboard-grid grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_460px]${clubModalOpen ? ' is-modal-covered' : ''}`} aria-hidden={clubModalOpen || undefined}>
        <div className="flex min-w-0 flex-col gap-6">
          {joinRequestNotice ? (
            <div role={joinRequestNotice.error ? 'alert' : 'status'} aria-live={joinRequestNotice.error ? 'assertive' : 'polite'} className={`rounded-lg border px-4 py-3 text-sm font-bold shadow-sm ${joinRequestNotice.error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
              {joinRequestNotice.message}
            </div>
          ) : null}
          {isManager && joinRequests.length > 0 ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-5">
              <h3 className="text-sm font-black uppercase tracking-[0.16em] text-amber-800">Join requests</h3>
              <div className="mt-4 space-y-3">
                {joinRequests.map((request) => (
                  <div key={request.uid} className="flex flex-col gap-3 rounded-lg border border-amber-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-bold text-slate-950">{request.displayName ?? request.email ?? 'Unknown user'}</p>
                      <p className="text-sm text-slate-500">{request.email}</p>
                    </div>
                    <div className="flex gap-2">
                      <button type="button" onClick={() => approveRequest(request, false)} disabled={joiningAction === request.uid} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-700 disabled:opacity-50">
                        Decline
                      </button>
                      <button type="button" onClick={() => approveRequest(request, true)} disabled={joiningAction === request.uid} className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">
                        Accept
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <div className={mobileView === 'standings' ? 'block md:block' : 'hidden md:block'}>
            <LeaderboardPanel clubId={clubId} seasonNumber={selectedSeasonNumber} scopeLabel={viewingAllCompetitions ? 'all seasons and tournaments' : selectedCompetition?.name} players={players} stats={playerStats} titleRules={titleRules} activePlayerMonths={activitySettings.activePlayerMonths} onPlayerAnalytics={(playerId) => { setAnalyticsPlayerId(playerId); setAnalyticsOpen(true) }} />
          </div>
        </div>

        <aside className={mobileView === 'session' ? 'club-session-panel order-first block md:block xl:order-none' : 'club-session-panel order-first hidden md:block xl:order-none'}>
          {viewingHistoricalCompetition ? (
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 text-amber-950">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-amber-700">{viewingAllCompetitions ? 'Club history' : `Historical ${selectedCompetition?.kind === 'tournament' ? 'tournament' : 'season'}`}</p>
              <h2 className="mt-2 text-lg font-black">{viewingAllCompetitions ? 'All seasons combined' : `${selectedCompetition?.name ?? `Season ${selectedSeasonNumber}`} is read-only`}</h2>
              <p className="mt-1 text-sm leading-6 text-amber-900">{viewingAllCompetitions ? 'Leaderboard and analytics combine every regular season and tournament in this club.' : `Standings and analytics show ${selectedCompetition?.name ?? `Season ${selectedSeasonNumber}`}.`} Return to {activeCompetition?.name ?? `Season ${activeSeasonNumber}`} to manage the current session.</p>
              <button type="button" onClick={() => changeSeason(String(activeSeasonNumber))} className="mt-4 min-h-10 rounded border border-amber-300 bg-white px-3 text-sm font-bold text-amber-900">Return to current</button>
            </section>
          ) : (
            <SessionManager clubId={clubId} seasonNumber={activeSeasonNumber} players={players} isManager={isManager} scoringRules={scoringRules} onAddPlayer={() => openRoster(true)} />
          )}
        </aside>
      </div>

        </div>
      </div>

      {rosterOpen ? (
        <div className="responsive-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div id="club-roster-dialog" data-tour="roster-modal" role="dialog" aria-modal="true" aria-labelledby="club-roster-title" className="responsive-modal-panel flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="p-5 pb-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">Club roster</p>
                <h3 id="club-roster-title" className="mt-2 text-xl font-black text-slate-950">Players and linked users</h3>
                <p className="mt-1 text-sm text-slate-500">{players.length} tracked players in {club?.name ?? membership.clubName}</p>
              </div>
              <button data-tour="roster-close" type="button" onClick={closeRoster} className="mr-5 mt-5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600">
                Close
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              {isManager ? (
                <section className="mb-5 rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <h4 className="text-sm font-black uppercase tracking-[0.16em] text-slate-700">Club managers</h4>
                  <p className="mt-1 text-sm leading-6 text-slate-600">Promote an existing user, or save a grant that applies when this email first signs in.</p>
                  <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                    <input
                      type="email"
                      value={managerEmail}
                      onChange={(event) => setManagerEmail(event.target.value)}
                      placeholder="manager@example.com"
                      className="min-h-11 min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-[rgb(var(--bamboo))]"
                    />
                    <button
                      type="button"
                      onClick={promoteManager}
                      disabled={promotingManager || !managerEmail.trim()}
                      className="min-h-11 rounded bg-[rgb(var(--bamboo))] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                    >
                      {promotingManager ? 'Promoting...' : 'Promote manager'}
                    </button>
                  </div>
                  {managerMessage ? <p role="status" aria-live="polite" className="mt-3 text-sm font-semibold text-slate-700">{managerMessage}</p> : null}
                </section>
              ) : null}
              <section ref={addPlayerSectionRef} className="scroll-mt-4 rounded-lg border border-teal-200 bg-teal-50 p-4">
                <h4 className="text-sm font-black uppercase tracking-[0.16em] text-teal-800">Add player</h4>
                <p className="mt-1 text-sm leading-6 text-slate-600">Any active club member can add a player to the roster.</p>
                <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_140px_auto]">
                  <label className="text-sm font-bold text-slate-700">
                    Player name
                    <input value={playerName} onChange={(event) => setPlayerName(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500" />
                  </label>
                  <label className="text-sm font-bold text-slate-700">
                    Player emoji
                    <div className="relative mt-2">
                      <input
                        value={playerIcon}
                        onClick={openNewPlayerEmojiPicker}
                        onFocus={() => { if (!iconPickerOpen) openNewPlayerEmojiPicker() }}
                        onChange={(event) => {
                          setPlayerIcon(event.target.value.slice(0, 12))
                          setPlayerMessage(null)
                        }}
                        data-emoji-picker-control
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                      />
                      {iconPickerOpen ? (
                        <div data-emoji-picker-control className="emoji-menu absolute right-0 top-[calc(100%+8px)] z-20 w-56 rounded border border-slate-200 bg-white p-3 shadow-xl">
                          <div className="emoji-picker grid grid-cols-4 gap-1" role="group" aria-label="Available emoji options">
                            {newPlayerEmojiChoices.filter((choice) => !usedIconKeys.has(choice.trim().toLocaleLowerCase())).map((choice) => (
                              <button
                                key={choice}
                                type="button"
                                onClick={() => {
                                  setPlayerIcon(choice)
                                  setPlayerMessage(null)
                                  setIconPickerOpen(false)
                                }}
                                className="flex h-11 w-11 items-center justify-center rounded border border-transparent bg-transparent text-xl hover:border-[rgb(var(--bamboo))] hover:bg-[rgb(var(--bamboo)/0.08)]"
                                title="Use this emoji"
                                aria-label={`Use ${choice} emoji`}
                              >
                                {choice}
                              </button>
                            ))}
                          </div>
                          <p className="mt-2 text-xs font-medium text-slate-500">Choose an available emoji for this player.</p>
                        </div>
                      ) : null}
                    </div>
                  </label>
                  <button type="button" onClick={addPlayer} className="self-end rounded-lg bg-teal-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-teal-500">
                    Add player
                  </button>
                  {!linkedPlayerForUser ? (
                    <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 lg:col-span-3">
                      <input type="checkbox" checked={linkToMe} onChange={(event) => setLinkToMe(event.target.checked)} />
                      Link this new player to my account
                    </label>
                  ) : null}
                </div>
              </section>
              {playerMessage ? <p role="status" aria-live="polite" className="mt-3 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">{playerMessage}</p> : null}

              <section className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">All players</h4>
                  <p className="text-sm font-semibold text-slate-500">{normalizedRosterSearch ? `${filteredRosterPlayers.length} of ${players.length}` : `${players.length} total`}</p>
                </div>
                <div className="relative mt-3">
                  <span aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">⌕</span>
                  <input
                    type="search"
                    value={rosterSearch}
                    onChange={(event) => setRosterSearch(event.target.value)}
                    placeholder="Search roster players…"
                    aria-label="Search roster players"
                    className="min-h-11 w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-base text-slate-900 outline-none transition focus:border-[rgb(var(--bamboo))] focus:ring-2 focus:ring-[rgb(var(--bamboo)/0.18)]"
                  />
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {filteredRosterPlayers.map((player) => (
                    <div key={player.id} className="relative rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-slate-300 hover:bg-white">
                      <div className="flex min-w-0 items-center gap-3">
                        {isManager || player.authUid === user?.uid ? (
                          <button
                            type="button"
                            onClick={() => togglePlayerEmojiPicker(player)}
                            onContextMenu={(event) => { event.preventDefault(); togglePlayerEmojiPicker(player, '') }}
                            aria-label={`Change ${player.displayName} emoji`}
                            title="Change emoji. Right-click to enter a custom emoji."
                            data-emoji-picker-control
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-lg text-slate-700 shadow-sm transition hover:scale-105 hover:border-[rgb(var(--bamboo))] hover:bg-[rgb(var(--bamboo)/0.12)] hover:ring-2 hover:ring-[rgb(var(--bamboo)/0.25)] focus-visible:ring-2 focus-visible:ring-[rgb(var(--bamboo))]"
                          >
                            {player.icon}
                          </button>
                        ) : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-lg" aria-hidden="true">{player.icon}</span>}
                        <div className="min-w-0">
                          <p className="break-words text-sm font-black leading-5 text-slate-900">{player.displayName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{player.authUid ? 'Linked user' : 'Tracked player'}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex min-h-9 items-center justify-between gap-2 border-t border-slate-200 pt-3">
                         {(player.authUid === user?.uid || (!player.authUid && !linkedPlayerForUser)) ? (
                           <button
                             type="button"
                             onClick={() => togglePlayerLink(player)}
                             disabled={linkingPlayerId !== null}
                             className="min-h-9 rounded border border-amber-200 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-amber-50 disabled:opacity-50 disabled:cursor-not-allowed"
                           >
                             {linkingPlayerId === player.id ? (
                               player.authUid === user?.uid ? 'Unlinking...' : 'Linking...'
                             ) : (
                               player.authUid === user?.uid ? 'Unlink account' : 'Link account'
                             )}
                           </button>
                         ) : null}
                        {isManager || player.authUid === user?.uid ? <div className="ml-auto flex items-center gap-2">
                          <button type="button" onClick={() => { setRenamingPlayerId(player.id); setRenamingPlayerValue(player.displayName) }} className="min-h-9 rounded border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-white">Rename</button>
                          {isManager ? <button type="button" onClick={() => deleteRosterPlayer(player)} aria-label={`Remove ${player.displayName}`} title="Remove player" className="flex h-9 w-9 items-center justify-center rounded border border-rose-200 text-lg font-bold text-rose-700 hover:bg-rose-50">×</button> : null}
                        </div> : null}
                      </div>
                      {renamingPlayerId === player.id ? (
                        <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void renamePlayer(player) }}>
                          <input autoFocus value={renamingPlayerValue} maxLength={80} onChange={(event) => setRenamingPlayerValue(event.target.value)} aria-label={`New name for ${player.displayName}`} className="min-h-10 min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 text-sm outline-none focus:border-[rgb(var(--bamboo))]" />
                          <button type="submit" className="rounded bg-[rgb(var(--bamboo))] px-3 text-xs font-bold text-white">Save</button>
                          <button type="button" onClick={() => setRenamingPlayerId(null)} className="rounded border border-slate-300 px-2 text-xs font-bold">Cancel</button>
                        </form>
                      ) : null}
                      {(isManager || player.authUid === user?.uid) && editingPlayerId === player.id ? (
                        <div data-emoji-picker-control className="emoji-menu absolute right-2 top-full z-20 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded border border-slate-200 bg-white p-3 shadow-xl">
                          <div className="emoji-picker grid grid-cols-4 gap-1" role="group" aria-label={`Available emoji options for ${player.displayName}`}>
                            {editingPlayerEmojiChoices.filter((choice) => !usedIconKeys.has(choice.trim().toLocaleLowerCase())).map((choice) => (
                              <button key={choice} type="button" onClick={() => changePlayerIcon(player, choice)} aria-label={`Use ${choice} emoji for ${player.displayName}`} className="flex h-11 w-11 items-center justify-center rounded border border-transparent bg-transparent text-xl hover:border-[rgb(var(--bamboo))] hover:bg-[rgb(var(--bamboo)/0.08)]">{choice}</button>
                            ))}
                          </div>
                          <form className="mt-3 border-t border-slate-200 pt-3" onSubmit={(event) => { event.preventDefault(); void changePlayerIcon(player, customEmojiValue) }}>
                            <label className="text-xs font-bold text-slate-600">Custom emoji</label>
                            <div className="mt-1 flex gap-2">
                              <input value={customEmojiValue} onChange={(event) => setCustomEmojiValue(event.target.value.slice(0, 12))} placeholder="Paste any emoji" aria-label={`Custom emoji for ${player.displayName}`} className="min-h-10 min-w-0 flex-1 rounded border border-slate-300 px-2 text-sm outline-none focus:border-[rgb(var(--bamboo))]" />
                              <button type="submit" className="rounded bg-[rgb(var(--bamboo))] px-3 text-xs font-bold text-white">Use</button>
                            </div>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
                {players.length === 0 ? (
                  <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                    No players yet.
                  </div>
                ) : null}
                {players.length > 0 && filteredRosterPlayers.length === 0 ? (
                  <div className="mt-3 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm font-semibold text-slate-500">
                    No roster players match “{rosterSearch.trim()}”.
                  </div>
                ) : null}
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {analyticsOpen ? (
        <div className="responsive-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div id="club-analytics-dialog" data-tour="analytics-modal" role="dialog" aria-modal="true" aria-labelledby="club-analytics-title" className="responsive-modal-panel flex max-h-[92vh] w-full max-w-6xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="club-analytics-header flex shrink-0 flex-col items-start justify-between gap-3 border-b border-slate-200 p-5 sm:flex-row">
              <div className="club-analytics-heading">
                <p className="club-analytics-kicker text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Analytics</p>
                <h3 id="club-analytics-title" className="mt-2 text-xl font-black text-slate-950">{club?.name ?? membership.clubName} insights</h3>
                <p className="club-analytics-description mt-1 text-sm text-slate-500">Dashboard charts, Skill movement, and club analytics.</p>
                <Link href="/metrics" className="club-analytics-metrics-link mt-3 inline-flex items-center gap-3 rounded-full border border-[rgb(var(--bamboo)/.45)] bg-[rgb(var(--bamboo)/.08)] px-4 py-2 text-xs font-black text-[rgb(var(--bamboo))] transition hover:translate-x-1 hover:bg-[rgb(var(--bamboo)/.14)]">
                  <span className="club-analytics-metrics-long">How are these metrics calculated?</span><span className="club-analytics-metrics-short">Metrics guide</span><span aria-hidden="true">→</span>
                </Link>
              </div>
              <div className="club-analytics-controls flex w-full shrink-0 flex-wrap items-end justify-between gap-2 sm:w-auto sm:justify-end">
                <label>
                  <span className="sr-only">Time window for all analytics</span>
                  <select aria-label="Time window for all analytics" value={analyticsWindowValue} onChange={(event) => {
                    const value = event.target.value
                    setAnalyticsWindowError(null)
                    if (value === 'all') setAnalyticsWindow(allSessionWindow())
                    else if (value === 'custom') applyAnalyticsCustomRange(analyticsStartDate, analyticsEndDate)
                    else setAnalyticsWindow(hoursSessionWindow(Number(value) as SessionPointWindowHours))
                  }} className="block min-h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-900">
                    {ANALYTICS_TIME_WINDOWS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>
                {analyticsWindow.mode === 'range' ? <>
                  <label className="text-[10px] font-black uppercase tracking-[.1em] text-slate-500">From<input type="date" value={analyticsStartDate} max={analyticsEndDate} onChange={(event) => { setAnalyticsStartDate(event.target.value); applyAnalyticsCustomRange(event.target.value, analyticsEndDate) }} className="mt-1 block min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold normal-case tracking-normal text-slate-900" /></label>
                  <label className="text-[10px] font-black uppercase tracking-[.1em] text-slate-500">To<input type="date" value={analyticsEndDate} min={analyticsStartDate} max={today} onChange={(event) => { setAnalyticsEndDate(event.target.value); applyAnalyticsCustomRange(analyticsStartDate, event.target.value) }} className="mt-1 block min-h-10 rounded-lg border border-slate-300 bg-white px-2 text-sm font-bold normal-case tracking-normal text-slate-900" /></label>
                </> : null}
                <button data-tour="analytics-close" type="button" onClick={() => setAnalyticsOpen(false)} className="club-analytics-close min-h-10 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600">
                  Close
                </button>
              </div>
              {analyticsWindowError ? <p role="alert" className="w-full text-right text-xs font-bold text-rose-700">{analyticsWindowError}</p> : null}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-slate-50 p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
              <div className="space-y-5">
                <DashboardContent clubId={clubId} clubName={club?.name ?? membership.clubName} seasonNumber={selectedSeasonNumber} initialPlayerId={analyticsPlayerId} linkedPlayerId={linkedPlayerForUser?.id ?? null} analyticsWindow={analyticsWindow} players={players} stats={playerStats} statsReady={playerStatsReady} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {gameLogsOpen && user ? (
        <GameLogsModal
          clubId={clubId}
          seasons={seasons}
          currentSeason={selectedSeasonNumber ?? activeSeasonNumber}
          userId={user.uid}
          isManager={isManager}
          onClose={() => setGameLogsOpen(false)}
        />
      ) : null}

      {networkOpen ? (
        <NetworkGraphModal
          clubId={clubId}
          players={players}
          seasons={seasons}
          currentSeason={selectedSeasonNumber ?? activeSeasonNumber}
          onClose={() => setNetworkOpen(false)}
        />
      ) : null}
    </main>
  )
}
