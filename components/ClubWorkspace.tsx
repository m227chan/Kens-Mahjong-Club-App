'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState, useRef } from 'react'
import DashboardContent from '@/components/DashboardContent'
import GameLogsModal from '@/components/GameLogsModal'
import NetworkGraphModal from '@/components/NetworkGraphModal'
import { LeaderboardPanel } from '@/components/Leaderboard'
import SessionManager from '@/components/SessionManager'
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
  setActiveSeason,
  setPlayerAuthLink,
  startNewSeason,
  updatePlayerIcon,
  updatePlayerName,
  subscribeClub,
  subscribeClubMembers,
  subscribeJoinRequests,
  subscribePlayers,
  subscribeSeasons
} from '@/lib/data'
import type { ClubDoc, ClubMembershipDoc, JoinRequestDoc, PlayerDoc, SeasonDoc } from '@/lib/types'
import { PLAYER_EMOJIS, randomUnusedPlayerEmoji } from '@/lib/players'
import { MAHJONG_CAMERA_COACH_ENABLED } from '@/lib/feature-flags'

const iconChoices = PLAYER_EMOJIS

function StatCard({ label, value, tone, explanation }: { label: string; value: string; tone: string; explanation: string }) {
  const [showInfo, setShowInfo] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showInfo) return
    const handleClickOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setShowInfo(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showInfo])

  return (
    <div ref={ref} className={`relative group rounded-lg border p-4 transition-all duration-200 hover:shadow-sm ${tone}`}>
      <div className="flex items-start justify-between">
        <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">{label}</p>
        <button
          type="button"
          onClick={() => setShowInfo(!showInfo)}
          className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-500/10 hover:bg-slate-500/20 text-current opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity duration-200"
          aria-label={`Learn more about ${label}`}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </button>
      </div>
      <p className="mt-2 text-2xl font-black">{value}</p>

      {/* Explanation Popup */}
      {showInfo && (
        <div className="absolute left-1/2 bottom-[calc(100%+8px)] z-20 w-64 -translate-x-1/2 rounded-lg border border-slate-200 bg-white p-3 shadow-lg text-slate-800 text-xs font-semibold leading-relaxed">
          <p>{explanation}</p>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-white"></div>
          <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-slate-200 -z-10 translate-y-[1px]"></div>
        </div>
      )}
    </div>
  )
}

export default function ClubWorkspace({ clubId, membership }: { clubId: string; membership: ClubMembershipDoc }) {
  const { user } = useAuth()
  const router = useRouter()
  const [club, setClub] = useState<ClubDoc | null>(null)
  const [members, setMembers] = useState<ClubMembershipDoc[]>([])
  const [joinRequests, setJoinRequests] = useState<JoinRequestDoc[]>([])
  const [players, setPlayers] = useState<PlayerDoc[]>([])
  const [playerName, setPlayerName] = useState('')
  const [playerIcon, setPlayerIcon] = useState(() => randomUnusedPlayerEmoji(new Set()))
  const [iconPickerOpen, setIconPickerOpen] = useState(false)
  const [linkToMe, setLinkToMe] = useState(false)
  const [playerMessage, setPlayerMessage] = useState<string | null>(null)
  const [joiningAction, setJoiningAction] = useState<string | null>(null)
  const [joinRequestNotice, setJoinRequestNotice] = useState<{ message: string; error: boolean } | null>(null)
  const [seasonMessage, setSeasonMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [gameLogsOpen, setGameLogsOpen] = useState(false)
  const [networkOpen, setNetworkOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [seasons, setSeasons] = useState<SeasonDoc[]>([])
  const [seasonAction, setSeasonAction] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [customEmojiValue, setCustomEmojiValue] = useState('')
  const [renamingPlayerId, setRenamingPlayerId] = useState<string | null>(null)
  const [renamingPlayerValue, setRenamingPlayerValue] = useState('')
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deletingClub, setDeletingClub] = useState(false)
  const [mobileView, setMobileView] = useState<'session' | 'standings' | 'roster'>('session')
  const [managerEmail, setManagerEmail] = useState('')
  const [managerMessage, setManagerMessage] = useState<string | null>(null)
  const [promotingManager, setPromotingManager] = useState(false)
  const [linkingPlayerId, setLinkingPlayerId] = useState<string | null>(null)

  const isManager = membership.role === 'manager'
  const { play } = useSound()
  const usedIconKeys = new Set(players.map((player) => player.icon.trim().toLocaleLowerCase()))
  const latestSeasonNumber = seasons.length ? seasons[seasons.length - 1].seasonNumber : club?.activeSeasonNumber ?? 1
  const activeSeasonNumber = club?.activeSeasonNumber ?? latestSeasonNumber
  const linkedPlayerForUser = user ? players.find((player) => player.authUid === user.uid) ?? null : null

  useEffect(() => subscribeClub(clubId, setClub), [clubId])
  useEffect(() => subscribeClubMembers(clubId, setMembers), [clubId])
  useEffect(() => subscribePlayers(clubId, setPlayers), [clubId])
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

  const addPlayer = async () => {
    setPlayerMessage(null)
    if (!playerName.trim()) {
      play('error')
      setPlayerMessage('Enter a player name.')
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

  const changeSeason = async (value: string) => {
    if (!user) return
    const seasonNumber = Number(value)
    if (!seasonNumber || seasonNumber === activeSeasonNumber) return
    setSeasonAction(true)
    setSeasonMessage(null)
    try {
      await setActiveSeason(clubId, seasonNumber)
      setClub((current) => current ? { ...current, activeSeasonNumber: seasonNumber } : current)
      setSeasons((current) => current.map((season) => ({ ...season, active: season.seasonNumber === seasonNumber })))
      setSeasonMessage(`Showing Season ${seasonNumber}.`)
      router.refresh()
    } catch (error) {
      setSeasonMessage(error instanceof Error ? error.message : 'Unable to change season.')
      play('error')
    } finally {
      setSeasonAction(false)
    }
  }

  const createNextSeason = async () => {
    if (!user) return
    if (!window.confirm('Start a new season? Current season data will remain available, and the active session will reset.')) return
    setSeasonAction(true)
    try {
      await startNewSeason(clubId, { createdBy: user.uid })
      setSettingsOpen(false)
      window.location.reload()
    } finally {
      setSeasonAction(false)
    }
  }

  return (
    <main className="px-4 py-6">
      <div data-tour="club-header" className="club-workspace-header mb-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-black text-slate-950">{club?.name ?? membership.clubName}</h1>
        </div>
        <div className="club-action-bar flex flex-wrap gap-2">
          <label data-tour="season-selector" className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
            <span className="text-xs uppercase tracking-[0.14em] text-slate-500">Season</span>
            <select
              value={activeSeasonNumber}
              onChange={(event) => changeSeason(event.target.value)}
              disabled={seasonAction}
              className="bg-transparent text-sm font-black text-slate-900 outline-none disabled:opacity-50"
              aria-label="Season"
            >
              {seasons.some((season) => season.seasonNumber === activeSeasonNumber) ? null : (
                <option value={activeSeasonNumber}>{activeSeasonNumber}</option>
              )}
              {seasons.map((season) => (
                <option key={season.id} value={season.seasonNumber}>{season.seasonNumber}</option>
              ))}
            </select>
          </label>
          {seasonMessage ? <span role="status" aria-live="polite" className="flex items-center rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{seasonMessage}</span> : null}
          <button
            type="button"
            onClick={copyShare}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            {copied ? 'Copied' : `Club ID: ${clubId}`}
          </button>
          <button
            data-tour="roster-open"
            type="button"
            onClick={() => {
              setPlayerMessage(null)
              setRosterOpen(true)
            }}
            className="club-secondary-action club-roster-action rounded-lg px-3 py-2 text-sm font-bold transition"
          >
            Roster
          </button>
          <button
            data-tour="analytics-open"
            type="button"
            onClick={() => setAnalyticsOpen(true)}
            className="club-secondary-action rounded-lg px-3 py-2 text-sm font-bold transition"
          >
            Analytics
          </button>
          <button
            data-tour="logs-open"
            type="button"
            onClick={() => setGameLogsOpen(true)}
            className="club-secondary-action rounded-lg px-3 py-2 text-sm font-bold transition"
          >
            Game logs
          </button>
          <button
            data-tour="network-open"
            type="button"
            onClick={() => setNetworkOpen(true)}
            className="club-secondary-action rounded-lg px-3 py-2 text-sm font-bold transition"
          >
            Network
          </button>
          {MAHJONG_CAMERA_COACH_ENABLED ? (
            <Link
              href={`/club/${clubId}/coach/`}
              className="club-secondary-action flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition md:hidden"
              aria-label="Open camera Mahjong coach"
            >
              <span aria-hidden="true">📷</span>
              <span>Coach</span>
            </Link>
          ) : null}
          <button
            data-tour="settings-open"
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Club settings"
            title="Club settings"
            className="club-secondary-action club-settings-action flex min-h-10 items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-bold transition"
          >
            <span aria-hidden="true" className="text-base">&#9881;</span>
            <span>Club settings</span>
          </button>
        </div>
      </div>

      {settingsOpen ? (
        <div className="responsive-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div data-tour="settings-modal" className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Club settings</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">{club?.name ?? membership.clubName}</h3>
                  <p className="mt-1 text-sm text-slate-500">Manage navigation and season controls for this club.</p>
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
            <div className="grid gap-3 p-5">
              <Link
                href="/"
                className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-black text-blue-800 transition hover:bg-blue-100"
              >
                Back to homepage
              </Link>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                <p className="text-sm font-black text-slate-900">Season controls</p>
                <p className="mt-1 text-sm text-slate-500">
                  Active season: Season {activeSeasonNumber}. New clubs start at Season 1 by default.
                </p>
                {isManager ? (
                  <button
                    type="button"
                    onClick={createNextSeason}
                    disabled={seasonAction}
                    className="mt-4 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-50"
                  >
                    {seasonAction ? 'Starting season...' : 'Start new season'}
                  </button>
                ) : (
                  <p className="mt-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-600">
                    Only the club manager can start a new season.
                  </p>
                )}
              </div>
              {isManager && !club?.universal ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-black text-rose-700">Delete club</p>
                  <p className="mt-1 text-sm text-rose-700">Permanently delete this club and all of its club-specific database records. This cannot be undone.</p>
                  <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600">Delete club</button>
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">Permanent action</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">Delete {club.name}?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              This permanently deletes the club for every member, including its roster and player links, memberships and join requests, games and scores, statistics and rankings, seasons, sessions and table layouts, QR codes, settings, and club audit history. Your account and other clubs are not affected. This cannot be undone.
            </p>
            <p className="mt-3 text-sm font-bold leading-6 text-rose-700">Type <strong>{club.name}</strong> exactly to confirm.</p>
            <input autoFocus value={deleteConfirmName} onChange={(event) => setDeleteConfirmName(event.target.value)} className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-rose-500" placeholder={club.name} />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmName('') }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Cancel</button>
              <button type="button" onClick={confirmDeleteClub} disabled={deleteConfirmName !== club.name || deletingClub} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{deletingClub ? 'Deleting...' : 'Delete club'}</button>
            </div>
          </div>
        </div>
      ) : null}

      <nav className="mobile-workspace-tabs sticky top-0 z-30 -mx-4 mb-4 grid grid-cols-3 border-y border-slate-200 bg-white/95 p-2 backdrop-blur md:hidden" aria-label="Club workspace">
        {([
          ['session', 'Session'],
          ['standings', 'Standings'],
          ['roster', 'Roster'],
        ] as const).map(([view, label]) => (
          <button
            key={view}
            data-tour={view === 'standings' ? 'standings-tab' : view === 'roster' ? 'roster-tab' : undefined}
            type="button"
            onClick={() => setMobileView(view)}
            aria-pressed={mobileView === view}
            className={mobileView === view ? 'mobile-workspace-tab active' : 'mobile-workspace-tab'}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="min-w-0 space-y-6">
          {joinRequestNotice ? (
            <div role="status" aria-live="polite" className={`rounded-lg border px-4 py-3 text-sm font-bold shadow-sm ${joinRequestNotice.error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-emerald-200 bg-emerald-50 text-emerald-800'}`}>
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

          <section id="players" className={mobileView === 'roster' ? 'block rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:block' : 'hidden rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:block'}>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-950">Club Roster</h3>
              </div>
            </div>
             <div className="club-roster-stats mt-5 grid gap-3 sm:grid-cols-3">
               <StatCard label="Tracked players" value={String(players.length)} tone="border-slate-200 bg-slate-50 text-slate-900" explanation="Tracked players are individual profiles created for the club roster to record game statistics." />
               <StatCard label="Linked users" value={String(players.filter((player) => player.authUid).length)} tone="border-blue-200 bg-blue-50 text-blue-900" explanation="Linked users are roster players who have linked their signed-in account to their player profile." />
               <StatCard label="Club members" value={String(members.length)} tone="border-teal-200 bg-teal-50 text-teal-900" explanation="Club members are registered users who have joined the club to view matches, standings, and stats." />
             </div>
            <button
              data-tour="roster-open"
              type="button"
              onClick={() => {
                setPlayerMessage(null)
                setRosterOpen(true)
              }}
              className="mobile-manage-players mt-3 block w-full rounded bg-[rgb(var(--bamboo))] px-4 py-3 text-sm font-bold text-white md:hidden"
            >
              Manage players
            </button>
          </section>

          <div className={mobileView === 'standings' ? 'block md:block' : 'hidden md:block'}>
            <LeaderboardPanel clubId={clubId} seasonNumber={activeSeasonNumber} players={players} />
          </div>
        </div>

        <aside className={mobileView === 'session' ? 'order-first block md:block xl:order-none xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto' : 'order-first hidden md:block xl:order-none xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto'}>
          <SessionManager clubId={clubId} seasonNumber={activeSeasonNumber} players={players} isManager={isManager} />
        </aside>
      </div>

      {rosterOpen ? (
        <div className="responsive-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div data-tour="roster-modal" className="responsive-modal-panel flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="p-5 pb-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">Club roster</p>
                <h3 className="mt-2 text-xl font-black text-slate-950">Players and linked users</h3>
                <p className="mt-1 text-sm text-slate-500">{players.length} tracked players in {club?.name ?? membership.clubName}</p>
              </div>
              <button data-tour="roster-close" type="button" onClick={() => setRosterOpen(false)} className="mr-5 mt-5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600">
                Close
              </button>
            </div>

            <div className="overflow-y-auto p-5">
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
                  {managerMessage ? <p className="mt-3 text-sm font-semibold text-slate-700">{managerMessage}</p> : null}
                </section>
              ) : null}
              {isManager ? <section className="rounded-lg border border-teal-200 bg-teal-50 p-4">
                <h4 className="text-sm font-black uppercase tracking-[0.16em] text-teal-800">Add player</h4>
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
                        onClick={() => setIconPickerOpen(true)}
                        onFocus={() => setIconPickerOpen(true)}
                        onChange={(event) => {
                          setPlayerIcon(event.target.value.slice(0, 12))
                          setPlayerMessage(null)
                        }}
                        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500"
                      />
                      {iconPickerOpen ? (
                        <div className="emoji-menu absolute right-0 top-[calc(100%+8px)] z-20 w-56 rounded border border-slate-200 bg-white p-3 shadow-xl">
                          <div className="emoji-picker grid grid-cols-4 gap-1">
                            {iconChoices.map((choice) => {
                              const used = usedIconKeys.has(choice.trim().toLocaleLowerCase())
                              return (
                                <button
                                  key={choice}
                                  type="button"
                                  disabled={used}
                                  onClick={() => {
                                    setPlayerIcon(choice)
                                    setPlayerMessage(null)
                                    setIconPickerOpen(false)
                                  }}
                                  className={`flex h-11 w-11 items-center justify-center rounded border text-xl ${used ? 'cursor-not-allowed border-transparent opacity-20' : 'border-transparent bg-transparent hover:border-[rgb(var(--bamboo))] hover:bg-[rgb(var(--bamboo)/0.08)]'}`}
                                  title={used ? 'Already in use' : 'Use this icon'}
                                >
                                  {choice}
                                </button>
                              )
                            })}
                          </div>
                          <p className="mt-2 text-xs font-medium text-slate-500">Choose a unique emoji for this player.</p>
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
                {playerMessage ? <p className="mt-3 text-sm font-semibold text-slate-700">{playerMessage}</p> : null}
              </section> : null}

              <section className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">All players</h4>
                  <p className="text-sm font-semibold text-slate-500">{players.length} total</p>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {players.map((player) => (
                    <div key={player.id} className="relative rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-slate-300 hover:bg-white">
                      <div className="flex min-w-0 items-center gap-3">
                        {isManager ? (
                          <button
                            type="button"
                            onClick={() => { setEditingPlayerId(editingPlayerId === player.id ? null : player.id); setCustomEmojiValue(player.icon) }}
                            onContextMenu={(event) => { event.preventDefault(); setEditingPlayerId(player.id); setCustomEmojiValue('') }}
                            aria-label={`Change ${player.displayName} emoji`}
                            title="Change emoji. Right-click to enter a custom emoji."
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
                        {isManager ? <div className="ml-auto flex items-center gap-2">
                          <button type="button" onClick={() => { setRenamingPlayerId(player.id); setRenamingPlayerValue(player.displayName) }} className="min-h-9 rounded border border-slate-300 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-white">Rename</button>
                          <button type="button" onClick={() => deleteRosterPlayer(player)} aria-label={`Remove ${player.displayName}`} title="Remove player" className="flex h-9 w-9 items-center justify-center rounded border border-rose-200 text-lg font-bold text-rose-700 hover:bg-rose-50">×</button>
                        </div> : null}
                      </div>
                      {renamingPlayerId === player.id ? (
                        <form className="mt-3 flex gap-2" onSubmit={(event) => { event.preventDefault(); void renamePlayer(player) }}>
                          <input autoFocus value={renamingPlayerValue} maxLength={80} onChange={(event) => setRenamingPlayerValue(event.target.value)} aria-label={`New name for ${player.displayName}`} className="min-h-10 min-w-0 flex-1 rounded border border-slate-300 bg-white px-2 text-sm outline-none focus:border-[rgb(var(--bamboo))]" />
                          <button type="submit" className="rounded bg-[rgb(var(--bamboo))] px-3 text-xs font-bold text-white">Save</button>
                          <button type="button" onClick={() => setRenamingPlayerId(null)} className="rounded border border-slate-300 px-2 text-xs font-bold">Cancel</button>
                        </form>
                      ) : null}
                      {isManager && editingPlayerId === player.id ? (
                        <div className="emoji-menu absolute right-2 top-full z-20 mt-2 w-64 max-w-[calc(100vw-3rem)] rounded border border-slate-200 bg-white p-3 shadow-xl">
                          <div className="emoji-picker grid grid-cols-4 gap-1">{iconChoices.map((choice) => {
                            const used = usedIconKeys.has(choice.toLocaleLowerCase()) && choice !== player.icon
                            return <button key={choice} type="button" disabled={used} onClick={() => changePlayerIcon(player, choice)} className="flex h-11 w-11 items-center justify-center rounded border border-transparent bg-transparent text-xl hover:border-[rgb(var(--bamboo))] hover:bg-[rgb(var(--bamboo)/0.08)] disabled:opacity-20">{choice}</button>
                          })}</div>
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
              </section>
            </div>
          </div>
        </div>
      ) : null}

      {analyticsOpen ? (
        <div className="responsive-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div data-tour="analytics-modal" className="responsive-modal-panel flex max-h-[92vh] w-full max-w-6xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Analytics</p>
                <h3 className="mt-2 text-xl font-black text-slate-950">{club?.name ?? membership.clubName} insights</h3>
                <p className="mt-1 text-sm text-slate-500">Dashboard charts, Skill movement, and club analytics.</p>
                <Link href="/metrics" className="mt-3 inline-flex items-center gap-3 rounded-full border border-[rgb(var(--bamboo)/.45)] bg-[rgb(var(--bamboo)/.08)] px-4 py-2 text-xs font-black text-[rgb(var(--bamboo))] transition hover:translate-x-1 hover:bg-[rgb(var(--bamboo)/.14)]">
                  <span>How are these metrics calculated?</span><span aria-hidden="true">→</span>
                </Link>
              </div>
              <button data-tour="analytics-close" type="button" onClick={() => setAnalyticsOpen(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600">
                Close
              </button>
            </div>
            <div className="overflow-y-auto bg-slate-50 p-5">
              <div className="space-y-5">
                <DashboardContent clubId={clubId} seasonNumber={activeSeasonNumber} />
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {gameLogsOpen && user ? (
        <GameLogsModal
          clubId={clubId}
          seasons={seasons}
          currentSeason={activeSeasonNumber}
          userId={user.uid}
          canDeleteGames={isManager}
          onClose={() => setGameLogsOpen(false)}
        />
      ) : null}

      {networkOpen ? (
        <NetworkGraphModal
          clubId={clubId}
          players={players}
          seasons={seasons}
          currentSeason={activeSeasonNumber}
          onClose={() => setNetworkOpen(false)}
        />
      ) : null}
    </main>
  )
}
