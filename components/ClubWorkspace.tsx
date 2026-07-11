'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import AnalyticsPanel from '@/components/AnalyticsPanel'
import DashboardContent from '@/components/DashboardContent'
import GameLogsModal from '@/components/GameLogsModal'
import { LeaderboardPanel } from '@/components/Leaderboard'
import SessionManager from '@/components/SessionManager'
import { useAuth } from '@/contexts/AuthContext'
import {
  createPlayer,
  deleteClub,
  ensureConfig,
  ensureSeasons,
  removePlayer,
  resolveJoinRequest,
  setActiveSeason,
  setPlayerAuthLink,
  startNewSeason,
  updatePlayerIcon,
  subscribeClub,
  subscribeClubMembers,
  subscribeJoinRequests,
  subscribePlayers,
  subscribeSeasons
} from '@/lib/firestore'
import type { ClubDoc, ClubMembershipDoc, JoinRequestDoc, PlayerDoc, SeasonDoc } from '@/lib/types'
import { PLAYER_EMOJIS, randomUnusedPlayerEmoji } from '@/lib/players'

const iconChoices = PLAYER_EMOJIS

function StatCard({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
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
  const [copied, setCopied] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const [gameLogsOpen, setGameLogsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [seasons, setSeasons] = useState<SeasonDoc[]>([])
  const [seasonAction, setSeasonAction] = useState(false)
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [deleteConfirmName, setDeleteConfirmName] = useState('')
  const [deletingClub, setDeletingClub] = useState(false)

  const isManager = membership.role === 'manager'
  const usedIconKeys = new Set(players.map((player) => player.icon.trim().toLocaleLowerCase()))
  const latestSeasonNumber = seasons.length ? seasons[seasons.length - 1].seasonNumber : club?.activeSeasonNumber ?? 1
  const activeSeasonNumber = club?.activeSeasonNumber ?? latestSeasonNumber

  useEffect(() => subscribeClub(clubId, setClub), [clubId])
  useEffect(() => subscribeClubMembers(clubId, setMembers), [clubId])
  useEffect(() => subscribePlayers(clubId, setPlayers), [clubId])
  useEffect(() => subscribeSeasons(clubId, setSeasons), [clubId])
  useEffect(() => {
    if (!isManager) {
      setJoinRequests([])
      return
    }
    return subscribeJoinRequests(clubId, setJoinRequests)
  }, [clubId, isManager])

  useEffect(() => {
    ensureConfig(clubId).catch(() => undefined)
    ensureSeasons(clubId, user?.uid ?? 'system').catch(() => undefined)
  }, [clubId, user?.uid])

  const addPlayer = async () => {
    setPlayerMessage(null)
    if (!playerName.trim()) {
      setPlayerMessage('Enter a player name.')
      return
    }

    if (usedIconKeys.has(playerIcon.trim().toLocaleLowerCase())) {
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
    } catch (error) {
      setPlayerMessage(error instanceof Error ? error.message : 'Unable to add player.')
    }
  }

  const togglePlayerLink = async (player: PlayerDoc) => {
    if (!user) return
    setPlayerMessage(null)
    try {
      await setPlayerAuthLink(clubId, player.id, user.uid, player.authUid !== user.uid)
      setPlayerMessage(player.authUid === user.uid ? `Unlinked from ${player.displayName}.` : `You are now linked to ${player.displayName}.`)
    } catch (error) {
      setPlayerMessage(error instanceof Error ? error.message : 'Unable to update player link.')
    }
  }
  const changePlayerIcon = async (player: PlayerDoc, icon: string) => {
    setPlayerMessage(null)
    try {
      await updatePlayerIcon(clubId, player.id, icon)
      setEditingPlayerId(null)
      setPlayerMessage(`${player.displayName}'s emoji was updated.`)
    } catch (error) {
      setPlayerMessage(error instanceof Error ? error.message : 'Unable to update emoji.')
    }
  }

  const confirmDeleteClub = async () => {
    if (!user || !club || deleteConfirmName !== club.name) return
    setDeletingClub(true)
    try {
      await deleteClub(clubId, user.uid)
      router.replace('/')
    } catch (error) {
      setPlayerMessage(error instanceof Error ? error.message : 'Unable to delete club.')
      setDeletingClub(false)
    }
  }
  const approveRequest = async (request: JoinRequestDoc, approved: boolean) => {
    if (!user || !club) return
    setJoiningAction(request.uid)
    try {
      await resolveJoinRequest({
        clubId,
        request,
        approved,
        managerUid: user.uid,
        clubName: club.name
      })
    } finally {
      setJoiningAction(null)
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
    try {
      await setActiveSeason(clubId, seasonNumber)
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
    } finally {
      setSeasonAction(false)
    }
  }

  return (
    <main className="px-4 py-6">
      <div className="mb-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Current club</p>
          <h1 className="mt-1 text-2xl font-black text-slate-950">{club?.name ?? membership.clubName}</h1>
        </div>
        <div className="club-action-bar flex flex-wrap gap-2">
          <label className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50">
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
          <button
            type="button"
            onClick={copyShare}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
          >
            {copied ? 'Copied' : `Club ID: ${clubId}`}
          </button>
          <button
            type="button"
            onClick={() => {
              setPlayerMessage(null)
              setRosterOpen(true)
            }}
            className="rounded-lg bg-teal-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-teal-500"
          >
            Roster
          </button>
          <button
            type="button"
            onClick={() => setAnalyticsOpen(true)}
            className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-indigo-500"
          >
            Analytics
          </button>
          <button
            type="button"
            onClick={() => setGameLogsOpen(true)}
            className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-bold text-white transition hover:bg-sky-500"
          >
            Game logs
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Settings"
            title="Settings"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-950 text-lg font-bold text-white transition hover:bg-slate-800"
          >
            ⚙️
          </button>
        </div>
      </div>

      {settingsOpen ? (
        <div className="responsive-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="border-b border-slate-200 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Settings</p>
                  <h3 className="mt-2 text-xl font-black text-slate-950">{club?.name ?? membership.clubName}</h3>
                  <p className="mt-1 text-sm text-slate-500">Manage navigation and season controls for this club.</p>
                </div>
                <button
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
              {isManager ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                  <p className="text-sm font-black text-rose-950">Delete club</p>
                  <p className="mt-1 text-sm text-rose-700">Remove this club from every member&apos;s active clubs. Game history will no longer be accessible.</p>
                  <button type="button" onClick={() => setDeleteConfirmOpen(true)} className="mt-4 rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white hover:bg-rose-600">Delete club</button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {deleteConfirmOpen && club ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-rose-600">Permanent action</p>
            <h3 className="mt-2 text-xl font-black text-slate-950">Delete {club.name}?</h3>
            <p className="mt-2 text-sm leading-6 text-slate-600">Type <strong>{club.name}</strong> exactly to confirm. The club will disappear for every member.</p>
            <input autoFocus value={deleteConfirmName} onChange={(event) => setDeleteConfirmName(event.target.value)} className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 outline-none focus:border-rose-500" placeholder={club.name} />
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => { setDeleteConfirmOpen(false); setDeleteConfirmName('') }} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-bold text-slate-700">Cancel</button>
              <button type="button" onClick={confirmDeleteClub} disabled={deleteConfirmName !== club.name || deletingClub} className="rounded-lg bg-rose-700 px-4 py-2 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-40">{deletingClub ? 'Deleting...' : 'Delete club'}</button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_460px]">
        <div className="min-w-0 space-y-6">
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

          <section id="players" className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Players</p>
                <h3 className="mt-2 text-lg font-black text-slate-950">Club roster</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {members.length} signed-in users, {players.length} tracked players. Open the roster to add, review, or remove players.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <StatCard label="Tracked players" value={String(players.length)} tone="border-slate-200 bg-slate-50 text-slate-900" />
              <StatCard label="Linked users" value={String(players.filter((player) => player.authUid).length)} tone="border-blue-200 bg-blue-50 text-blue-900" />
              <StatCard label="Club members" value={String(members.length)} tone="border-teal-200 bg-teal-50 text-teal-900" />
            </div>
          </section>

          <LeaderboardPanel clubId={clubId} seasonNumber={activeSeasonNumber} />
        </div>

        <aside className="order-first xl:order-none xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
          <SessionManager clubId={clubId} seasonNumber={activeSeasonNumber} />
        </aside>
      </div>

      {rosterOpen ? (
        <div className="responsive-modal fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div className="responsive-modal-panel flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div className="p-5 pb-0">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">Club roster</p>
                <h3 className="mt-2 text-xl font-black text-slate-950">Players and linked users</h3>
                <p className="mt-1 text-sm text-slate-500">{players.length} tracked players in {club?.name ?? membership.clubName}</p>
              </div>
              <button type="button" onClick={() => setRosterOpen(false)} className="mr-5 mt-5 rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600">
                Close
              </button>
            </div>

            <div className="overflow-y-auto p-5">
              <section className="rounded-lg border border-teal-200 bg-teal-50 p-4">
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
                  <label className="flex items-center gap-2 text-sm font-semibold text-slate-600 lg:col-span-3">
                    <input type="checkbox" checked={linkToMe} onChange={(event) => setLinkToMe(event.target.checked)} />
                    This player is me
                  </label>
                </div>
                {playerMessage ? <p className="mt-3 text-sm font-semibold text-slate-700">{playerMessage}</p> : null}
              </section>

              <section className="mt-5">
                <div className="flex items-center justify-between gap-3">
                  <h4 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">All players</h4>
                  <p className="text-sm font-semibold text-slate-500">{players.length} total</p>
                </div>
                <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {players.map((player) => (
                    <div key={player.id} className="relative rounded-xl border border-slate-200 bg-slate-50 p-3 transition hover:border-slate-300 hover:bg-white">
                      <div className="flex min-w-0 items-center gap-3">
                        <button type="button" onClick={() => setEditingPlayerId(editingPlayerId === player.id ? null : player.id)} aria-label={`Change ${player.displayName} emoji`} title="Change emoji" className="flex h-11 w-11 shrink-0 items-center justify-center rounded border border-slate-200 bg-white text-lg text-slate-700 shadow-sm hover:border-[rgb(var(--bamboo))]">
                          {player.icon}
                        </button>
                        <div className="min-w-0">
                          <p className="break-words text-sm font-black leading-5 text-slate-900">{player.displayName}</p>
                          <p className="mt-0.5 text-xs text-slate-500">{player.authUid ? 'Linked user' : 'Tracked player'}</p>
                        </div>
                      </div>
                      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-200 pt-3">
                        {(!player.authUid || player.authUid === user?.uid) ? (
                          <button type="button" onClick={() => togglePlayerLink(player)} className="min-h-9 rounded border border-amber-200 px-2 py-1 text-xs font-bold text-slate-700 hover:bg-amber-50">
                            {player.authUid === user?.uid ? 'Unlink account' : 'Link account'}
                          </button>
                        ) : null}
                        <button type="button" onClick={() => removePlayer(clubId, player.id)} aria-label={`Remove ${player.displayName}`} title="Remove player" className="flex h-9 w-9 items-center justify-center rounded border border-rose-200 text-lg font-bold text-rose-700 hover:bg-rose-50">
                          ×
                        </button>
                      </div>
                      {editingPlayerId === player.id ? (
                        <div className="emoji-picker emoji-menu absolute right-2 top-full z-20 mt-2 grid w-56 grid-cols-4 gap-1 rounded border border-slate-200 bg-white p-3 shadow-xl">
                          {iconChoices.map((choice) => {
                            const used = usedIconKeys.has(choice.toLocaleLowerCase()) && choice !== player.icon
                            return <button key={choice} type="button" disabled={used} onClick={() => changePlayerIcon(player, choice)} className="flex h-11 w-11 items-center justify-center rounded border border-transparent bg-transparent text-xl hover:border-[rgb(var(--bamboo))] hover:bg-[rgb(var(--bamboo)/0.08)] disabled:opacity-20">{choice}</button>
                          })}
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
          <div className="responsive-modal-panel flex max-h-[92vh] w-full max-w-6xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Analytics</p>
                <h3 className="mt-2 text-xl font-black text-slate-950">{club?.name ?? membership.clubName} insights</h3>
                <p className="mt-1 text-sm text-slate-500">Dashboard charts, ELO movement, and club analytics.</p>
              </div>
              <button type="button" onClick={() => setAnalyticsOpen(false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-bold text-slate-600">
                Close
              </button>
            </div>
            <div className="overflow-y-auto bg-slate-50 p-5">
              <div className="space-y-5">
                <DashboardContent clubId={clubId} seasonNumber={activeSeasonNumber} />
                <AnalyticsPanel clubId={clubId} seasonNumber={activeSeasonNumber} />
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
    </main>
  )
}
