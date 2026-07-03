'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import {
  createClub,
  ensureConfig,
  leaveClub,
  requestToJoinClub,
  subscribePlayerStats,
  subscribePlayers,
  subscribeUserClubs
} from '@/lib/firestore'
import type { ClubMembershipDoc, PlayerDoc, PlayerStatsDoc } from '@/lib/types'

function HomeStat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className={`rounded-lg border p-4 ${tone}`}>
      <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-70">{label}</p>
      <p className="mt-2 text-2xl font-black">{value}</p>
    </div>
  )
}

export default function HomePage() {
  const router = useRouter()
  const { user, loading, signOut } = useAuth()
  const [clubs, setClubs] = useState<ClubMembershipDoc[]>([])
  const [newClubName, setNewClubName] = useState('')
  const [joinClubId, setJoinClubId] = useState('')
  const [clubPlayers, setClubPlayers] = useState<Record<string, PlayerDoc[]>>({})
  const [clubStats, setClubStats] = useState<Record<string, PlayerStatsDoc[]>>({})
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [loading, router, user])

  useEffect(() => {
    if (!user) return
    return subscribeUserClubs(
      user.uid,
      (nextClubs) => {
        setMessage(null)
        setClubs(nextClubs)
      },
      (error) => {
        setClubs([])
        setMessage(error.message)
      }
    )
  }, [user])

  useEffect(() => {
    if (!user || clubs.length === 0) {
      setClubPlayers({})
      setClubStats({})
      return
    }

    const unsubscribers = clubs.flatMap((club) => [
      subscribePlayers(club.clubId, (players) => {
        setClubPlayers((current) => ({ ...current, [club.clubId]: players }))
      }),
      subscribePlayerStats(club.clubId, (stats) => {
        setClubStats((current) => ({ ...current, [club.clubId]: stats }))
      })
    ])

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe())
    }
  }, [clubs, user])

  const homeStats = useMemo(() => {
    const managed = clubs.filter((club) => club.role === 'manager').length
    return {
      total: clubs.length,
      managed,
      joined: Math.max(0, clubs.length - managed)
    }
  }, [clubs])

  const personalStats = useMemo(() => {
    const linkedPlayerIdsByClub = Object.fromEntries(
      clubs.map((club) => [
        club.clubId,
        new Set((clubPlayers[club.clubId] ?? []).filter((player) => player.authUid === user?.uid).map((player) => player.id))
      ])
    ) as Record<string, Set<string>>

    const totals = clubs.reduce((acc, club) => {
      const linkedPlayerIds = linkedPlayerIdsByClub[club.clubId] ?? new Set<string>()
      const matchingStats = (clubStats[club.clubId] ?? []).filter((entry) => linkedPlayerIds.has(entry.playerId))

      matchingStats.forEach((entry) => {
        acc.gamesPlayed += entry.gamesPlayed
        acc.gamesWon += entry.gamesWon
        acc.gamesLost += entry.gamesLost
        acc.totalPoints += entry.totalPoints
      })

      acc.linkedPlayers += linkedPlayerIds.size
      return acc
    }, {
      gamesPlayed: 0,
      gamesWon: 0,
      gamesLost: 0,
      totalPoints: 0,
      linkedPlayers: 0
    })

    return {
      ...totals,
      winRate: totals.gamesPlayed ? Math.round((totals.gamesWon / totals.gamesPlayed) * 100) : 0
    }
  }, [clubPlayers, clubStats, clubs, user?.uid])

  const handleCreateClub = async () => {
    if (!user) return
    setBusy(true)
    setMessage(null)
    try {
      const clubId = await createClub({ name: newClubName, user })
      await ensureConfig(clubId)
      setNewClubName('')
      router.push(`/club/${encodeURIComponent(clubId)}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to create club.')
    } finally {
      setBusy(false)
    }
  }

  const handleJoinClub = async () => {
    if (!user) return
    setBusy(true)
    setMessage(null)
    try {
      const result = await requestToJoinClub({
        clubId: joinClubId,
        user,
        appUrl: typeof window !== 'undefined' ? window.location.origin : ''
      })
      const cleanClubId = joinClubId.trim().toUpperCase()
      setJoinClubId('')
      if (result === 'already-member') {
        router.push(`/club/${encodeURIComponent(cleanClubId)}`)
        return
      }
      setMessage('Request sent to the club manager.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to request access.')
    } finally {
      setBusy(false)
    }
  }

  const handleLeaveClub = async (clubId: string) => {
    if (!user) return
    setMessage(null)
    try {
      await leaveClub({ clubId, uid: user.uid })
      setMessage('You left the club.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to leave club.')
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
          Loading your homepage...
        </div>
      </main>
    )
  }

  return (
    <main className="px-4 py-6">
      <div className="grid gap-6 lg:grid-cols-[360px_minmax(0,1fr)]">
        <aside className="space-y-4">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-600">Welcome</p>
                <h1 className="mt-2 text-2xl font-black text-slate-950">{user.displayName ?? 'Mahjong scorer'}</h1>
              </div>
              <button type="button" onClick={signOut} className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-bold text-slate-600">
                Sign out
              </button>
            </div>
            <p className="mt-4 text-sm leading-6 text-slate-600">
              Ken&apos;s Mahjong Club keeps your groups, score history, standings, and session tools organized across every club you play with.
            </p>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Start a club</h2>
            <input
              value={newClubName}
              onChange={(event) => setNewClubName(event.target.value)}
              placeholder="Club name"
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
            />
            <button type="button" onClick={handleCreateClub} disabled={busy} className="mt-3 w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              Create club
            </button>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-[0.16em] text-slate-600">Join a club</h2>
            <input
              value={joinClubId}
              onChange={(event) => setJoinClubId(event.target.value.toUpperCase())}
              placeholder="Club ID"
              className="mt-4 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm uppercase outline-none focus:border-teal-500"
            />
            <button type="button" onClick={handleJoinClub} disabled={busy} className="mt-3 w-full rounded-lg bg-teal-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
              Request to join
            </button>
          </section>

          {message ? <p className="rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-600 shadow-sm">{message}</p> : null}
        </aside>

        <div className="space-y-6">
          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-600">Your homepage</p>
            <div className="mt-2 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 className="text-2xl font-black text-slate-950">Club menu and personal overview</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                  Pick a club to open its dedicated workspace. Club sessions, rosters, leaderboards, charts, and analytics live inside each club page.
                </p>
              </div>
            </div>
            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              <HomeStat label="Your clubs" value={String(homeStats.total)} tone="border-indigo-200 bg-indigo-50 text-indigo-900" />
              <HomeStat label="Managing" value={String(homeStats.managed)} tone="border-blue-200 bg-blue-50 text-blue-900" />
              <HomeStat label="Joined" value={String(homeStats.joined)} tone="border-teal-200 bg-teal-50 text-teal-900" />
            </div>
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-teal-600">Your player stats</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Across all clubs</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Totals include every tracked player linked to your signed-in user across clubs you belong to.
            </p>
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <HomeStat label="Your win rate" value={`${personalStats.winRate}%`} tone="border-teal-200 bg-teal-50 text-teal-900" />
              <HomeStat label="Your games" value={String(personalStats.gamesPlayed)} tone="border-blue-200 bg-blue-50 text-blue-900" />
              <HomeStat label="Wins / losses" value={`${personalStats.gamesWon}/${personalStats.gamesLost}`} tone="border-amber-200 bg-amber-50 text-amber-900" />
              <HomeStat label="Your points" value={String(personalStats.totalPoints)} tone="border-rose-200 bg-rose-50 text-rose-900" />
            </div>
            {personalStats.linkedPlayers === 0 ? (
              <p className="mt-3 text-sm font-medium text-slate-500">Link a club player to yourself from a club roster to populate these stats.</p>
            ) : null}
          </section>

          <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Club selection</p>
                <h2 className="mt-2 text-xl font-black text-slate-950">Open a club</h2>
              </div>
              <p className="text-sm font-semibold text-slate-500">{clubs.length} active club{clubs.length === 1 ? '' : 's'}</p>
            </div>

            {clubs.length > 0 ? (
              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {clubs.map((club) => (
                  <article key={club.clubId} className="rounded-lg border border-slate-200 bg-slate-50 p-4 transition hover:border-teal-300 hover:bg-teal-50">
                    <p className="text-lg font-black text-slate-950">{club.clubName}</p>
                    <p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{club.role} - {club.clubId}</p>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link href={`/club/${encodeURIComponent(club.clubId)}`} className="rounded-lg bg-slate-950 px-3 py-2 text-sm font-bold text-white transition hover:bg-slate-800">
                        Open club
                      </Link>
                      {club.role !== 'manager' ? (
                        <button type="button" onClick={() => handleLeaveClub(club.clubId)} className="rounded-lg border border-rose-200 px-3 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50">
                          Leave
                        </button>
                      ) : null}
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="mt-5 rounded-lg border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
                <h3 className="text-lg font-black text-slate-950">No clubs yet</h3>
                <p className="mt-2 text-sm text-slate-500">Create a new club or request access with a club ID.</p>
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  )
}
