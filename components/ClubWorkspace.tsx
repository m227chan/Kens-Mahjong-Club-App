'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import AnalyticsPanel from '@/components/AnalyticsPanel'
import DashboardContent from '@/components/DashboardContent'
import { LeaderboardPanel } from '@/components/Leaderboard'
import SessionManager from '@/components/SessionManager'
import { useAuth } from '@/contexts/AuthContext'
import {
  createPlayer,
  ensureConfig,
  removePlayer,
  resolveJoinRequest,
  subscribeClub,
  subscribeClubMembers,
  subscribeJoinRequests,
  subscribePlayers
} from '@/lib/firestore'
import type { ClubDoc, ClubMembershipDoc, JoinRequestDoc, PlayerDoc } from '@/lib/types'

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
  const [club, setClub] = useState<ClubDoc | null>(null)
  const [members, setMembers] = useState<ClubMembershipDoc[]>([])
  const [joinRequests, setJoinRequests] = useState<JoinRequestDoc[]>([])
  const [players, setPlayers] = useState<PlayerDoc[]>([])
  const [playerName, setPlayerName] = useState('')
  const [playerIcon, setPlayerIcon] = useState('M')
  const [linkToMe, setLinkToMe] = useState(false)
  const [playerMessage, setPlayerMessage] = useState<string | null>(null)
  const [joiningAction, setJoiningAction] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [rosterOpen, setRosterOpen] = useState(false)

  const isManager = membership.role === 'manager'

  useEffect(() => subscribeClub(clubId, setClub), [clubId])
  useEffect(() => subscribeClubMembers(clubId, setMembers), [clubId])
  useEffect(() => subscribePlayers(clubId, setPlayers), [clubId])
  useEffect(() => {
    if (!isManager) {
      setJoinRequests([])
      return
    }
    return subscribeJoinRequests(clubId, setJoinRequests)
  }, [clubId, isManager])

  useEffect(() => {
    ensureConfig(clubId).catch(() => undefined)
  }, [clubId])

  const addPlayer = async () => {
    setPlayerMessage(null)
    if (!playerName.trim()) {
      setPlayerMessage('Enter a player name.')
      return
    }

    try {
      await createPlayer(clubId, {
        displayName: playerName,
        icon: playerIcon,
        authUid: linkToMe ? user?.uid ?? null : null
      })
      setPlayerName('')
      setPlayerIcon('M')
      setLinkToMe(false)
      setPlayerMessage('Player added.')
    } catch (error) {
      setPlayerMessage(error instanceof Error ? error.message : 'Unable to add player.')
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

  return (
    <main className="px-4 py-6">
      <div className="mb-5 flex flex-col gap-3 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link href="/" className="text-sm font-bold text-blue-600 hover:text-blue-500">
            Back to homepage
          </Link>
          <h1 className="mt-2 text-2xl font-black text-slate-950">{club?.name ?? membership.clubName}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
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
        </div>
      </div>

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
              <button type="button" onClick={() => setRosterOpen(true)} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white">
                Open roster
              </button>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <StatCard label="Tracked players" value={String(players.length)} tone="border-slate-200 bg-slate-50 text-slate-900" />
              <StatCard label="Linked users" value={String(players.filter((player) => player.authUid).length)} tone="border-blue-200 bg-blue-50 text-blue-900" />
              <StatCard label="Club members" value={String(members.length)} tone="border-teal-200 bg-teal-50 text-teal-900" />
            </div>
          </section>

          <LeaderboardPanel clubId={clubId} />
          <DashboardContent clubId={clubId} />
          <AnalyticsPanel clubId={clubId} />
        </div>

        <aside className="xl:sticky xl:top-20 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto">
          <SessionManager clubId={clubId} />
        </aside>
      </div>

      {rosterOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4 py-6">
          <div className="flex max-h-[90vh] w-full max-w-5xl flex-col rounded-lg border border-slate-200 bg-white shadow-2xl">
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
                    Icon or initial
                    <input value={playerIcon} onChange={(event) => setPlayerIcon(event.target.value)} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-teal-500" />
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
                    <div key={player.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-sm font-black text-slate-700 shadow-sm">
                          {player.icon}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-black text-slate-900">{player.displayName}</p>
                          <p className="truncate text-xs text-slate-500">{player.authUid ? 'Linked user' : 'Tracked player'}</p>
                        </div>
                      </div>
                      <button type="button" onClick={() => removePlayer(clubId, player.id)} className="rounded-lg border border-rose-200 px-2 py-1 text-xs font-bold text-rose-700 hover:bg-rose-50">
                        Remove
                      </button>
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
    </main>
  )
}
