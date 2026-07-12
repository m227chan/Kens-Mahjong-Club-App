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

function CountUp({ value, suffix = '' }: { value: number; suffix?: string }) {
  const [display, setDisplay] = useState(value)

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setDisplay(value)
      return
    }
    const duration = 620
    const started = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const progress = Math.min(1, (now - started) / duration)
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplay(Math.round(value * eased))
      if (progress < 1) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [value])

  return <>{display}{suffix}</>
}

function TrendLine({ values }: { values: number[] }) {
  const points = useMemo(() => {
    const source = values.length > 1 ? values : [0, values[0] ?? 0]
    const cumulative = source.map((_, index) => source.slice(0, index + 1).reduce((sum, value) => sum + value, 0))
    const min = Math.min(...cumulative)
    const max = Math.max(...cumulative)
    const range = Math.max(1, max - min)
    return cumulative.map((value, index) => `${(index / Math.max(1, cumulative.length - 1)) * 180},${42 - ((value - min) / range) * 34}`).join(' ')
  }, [values])

  return (
    <svg viewBox="0 0 180 50" className="h-12 w-full overflow-visible" role="img" aria-label="Recent combined ELO movement">
      <line x1="0" y1="43" x2="180" y2="43" stroke="rgb(var(--line))" strokeWidth="1" />
      <polyline className="home-trend-line" points={points} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function LoadingHome() {
  return (
    <main className="home-dashboard px-4 py-7" aria-label="Loading dashboard">
      <div className="home-skeleton h-16 w-72" />
      <div className="mt-7 home-skeleton h-60 w-full" />
      <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3].map((item) => <div key={item} className="home-skeleton h-56" />)}
      </div>
    </main>
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
  const [dataError, setDataError] = useState(false)
  const [hour, setHour] = useState(12)

  useEffect(() => setHour(new Date().getHours()), [])
  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, router, user])

  useEffect(() => {
    if (!user) return
    return subscribeUserClubs(user.uid, (nextClubs) => {
      setDataError(false)
      setClubs(nextClubs)
    }, () => {
      setClubs([])
      setDataError(true)
    })
  }, [user])

  useEffect(() => {
    if (!user || clubs.length === 0) {
      setClubPlayers({})
      setClubStats({})
      return
    }
    const unsubscribers = clubs.flatMap((club) => [
      subscribePlayers(club.clubId, (players) => setClubPlayers((current) => ({ ...current, [club.clubId]: players }))),
      subscribePlayerStats(club.clubId, (stats) => setClubStats((current) => ({ ...current, [club.clubId]: stats })))
    ])
    return () => unsubscribers.forEach((unsubscribe) => unsubscribe())
  }, [clubs, user])

  const clubSummaries = useMemo(() => clubs.map((club) => {
    const player = (clubPlayers[club.clubId] ?? []).find((entry) => entry.authUid === user?.uid) ?? null
    const stats = player ? (clubStats[club.clubId] ?? []).find((entry) => entry.playerId === player.id) ?? null : null
    return { club, player, stats }
  }), [clubPlayers, clubStats, clubs, user?.uid])

  const rollup = useMemo(() => {
    const stats = clubSummaries.flatMap((summary) => summary.stats ? [summary.stats] : [])
    const games = stats.reduce((sum, entry) => sum + entry.gamesPlayed, 0)
    const wins = stats.reduce((sum, entry) => sum + entry.gamesWon, 0)
    const trendValues = stats.flatMap((entry) => entry.recentEloDeltas ?? [])
    const trend = trendValues.reduce((sum, value) => sum + value, 0)
    return { games, winRate: games ? Math.round((wins / games) * 100) : 0, trend, trendValues }
  }, [clubSummaries])

  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const firstName = user?.displayName?.trim().split(/\s+/)[0] ?? 'Player'

  const handleCreateClub = async () => {
    if (!user) return
    setBusy(true); setMessage(null)
    try {
      const clubId = await createClub({ name: newClubName, user })
      await ensureConfig(clubId)
      setNewClubName('')
      router.push(`/club/${encodeURIComponent(clubId)}`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not create that club. Please try again.')
    } finally { setBusy(false) }
  }

  const handleJoinClub = async () => {
    if (!user) return
    setBusy(true); setMessage(null)
    try {
      const result = await requestToJoinClub({ clubId: joinClubId, user, appUrl: window.location.origin })
      const cleanClubId = joinClubId.trim().toUpperCase()
      setJoinClubId('')
      if (result === 'already-member') router.push(`/club/${encodeURIComponent(cleanClubId)}`)
      else setMessage('Your request was sent to the club manager.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not send that request. Please try again.')
    } finally { setBusy(false) }
  }

  const handleLeaveClub = async (clubId: string) => {
    if (!user) return
    try {
      await leaveClub({ clubId, uid: user.uid })
      setMessage('You left the club.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'We could not update your membership.')
    }
  }

  if (loading || !user) return <LoadingHome />

  return (
    <main className="home-dashboard px-4 py-7 sm:px-6 lg:px-8">
      <header className="home-enter home-greeting flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-extrabold uppercase tracking-[0.24em] text-[rgb(var(--cinnabar))]">Personal dashboard</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-[-0.035em] text-slate-950 sm:text-4xl">{greeting}, {firstName}</h1>
          <p className="mt-2 text-sm text-slate-600">Your play across every club, in one place.</p>
        </div>
        <button type="button" onClick={signOut} className="self-start rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:border-[rgb(var(--cinnabar))] sm:self-auto">Sign out</button>
      </header>

      {dataError ? (
        <div className="mt-7 rounded-lg border border-amber-200 bg-amber-50 p-5 text-sm text-slate-700">
          <strong className="block text-slate-950">Your dashboard could not be refreshed.</strong>
          Check your connection and reload when you are ready.
        </div>
      ) : null}

      <section className="home-enter home-summary mt-7 overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="grid lg:grid-cols-[1fr_250px]">
          <div className="p-6 sm:p-8">
            <p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">Overall performance</p>
            <div className="mt-6 grid grid-cols-2 gap-x-5 gap-y-7 lg:grid-cols-4">
              <div><p className="home-number"><CountUp value={rollup.games} /></p><p className="home-label">Games played</p></div>
              <div><p className="home-number"><CountUp value={rollup.winRate} suffix="%" /></p><p className="home-label">Overall win rate</p></div>
              <div>
                <p className={`home-number ${rollup.trend > 0 ? 'text-[rgb(var(--bamboo))]' : rollup.trend < 0 ? 'text-[rgb(var(--cinnabar))]' : ''}`}>
                  {rollup.trend > 0 ? '+' : ''}<CountUp value={rollup.trend} />
                </p>
                <p className="home-label">Recent ELO trend</p>
              </div>
              <div><p className="home-number"><CountUp value={clubs.length} /></p><p className="home-label">Clubs joined</p></div>
            </div>
          </div>
          <div className={`home-trend-card flex flex-col justify-end border-t border-slate-200 p-6 lg:border-l lg:border-t-0 ${rollup.trend >= 0 ? 'text-[rgb(var(--bamboo))]' : 'text-[rgb(var(--cinnabar))]'}`}>
            <TrendLine values={rollup.trendValues} />
            <p className="mt-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-500">Latest rating movement</p>
          </div>
        </div>
      </section>

      <section className="mt-9">
        <div className="flex items-end justify-between gap-4">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">Memberships</p><h2 className="mt-2 text-2xl font-extrabold text-slate-950">Your clubs</h2></div>
          <p className="text-sm font-semibold text-slate-500">{clubs.length} active</p>
        </div>

        {clubSummaries.length ? (
          <div className="home-club-wave mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {clubSummaries.map(({ club, player, stats }, index) => (
              <article key={club.clubId} className="home-club-card rounded-lg border border-slate-200 bg-white p-5" style={{ '--club-delay': `${index * 65}ms` } as React.CSSProperties}>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0"><h3 className="truncate text-xl font-extrabold text-slate-950">{club.clubName}</h3><p className="mt-1 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">{club.role} · {club.clubId}</p></div>
                  <span className="flex h-11 w-9 shrink-0 items-center justify-center rounded border border-slate-200 bg-slate-50 text-xl">{player?.icon ?? '🀄'}</span>
                </div>

                {player && stats ? (
                  <>
                    <p className="mt-5 text-sm font-bold text-slate-700">Playing as {player.displayName}</p>
                    <div className="mt-4 grid grid-cols-3 gap-3 border-y border-slate-200 py-4">
                      <div><p className="club-stat">{stats.eloRating}</p><p className="club-label">ELO</p></div>
                      <div><p className="club-stat">{stats.gamesPlayed ? Math.round((stats.gamesWon / stats.gamesPlayed) * 100) : 0}%</p><p className="club-label">Win rate</p></div>
                      <div><p className="club-stat">#{stats.pointsRank || '–'}</p><p className="club-label">Standing</p></div>
                    </div>
                    <p className="mt-3 text-xs font-semibold text-slate-500">{stats.gamesPlayed} recorded game{stats.gamesPlayed === 1 ? '' : 's'}</p>
                  </>
                ) : (
                  <div className="mt-5 rounded border border-dashed border-amber-200 bg-amber-50 p-4">
                    <p className="text-sm font-bold text-slate-900">No player linked yet</p>
                    <p className="mt-1 text-xs leading-5 text-slate-600">Open the roster and link your account to your player profile to see personal stats.</p>
                  </div>
                )}

                <div className="mt-5 flex items-center gap-2">
                  <Link href={`/club/${encodeURIComponent(club.clubId)}`} className="flex-1 rounded bg-[rgb(var(--ink))] px-4 py-2.5 text-center text-sm font-bold text-[rgb(var(--surface))] hover:opacity-90">{player ? 'Open club' : 'Open roster'}</Link>
                  {club.role !== 'manager' && !club.universal ? <button type="button" onClick={() => handleLeaveClub(club.clubId)} className="rounded border border-rose-200 px-3 py-2.5 text-sm font-bold text-rose-700 hover:bg-rose-50">Leave</button> : null}
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="home-first-step mt-5 rounded-lg border border-slate-200 bg-white p-7 sm:p-9">
            <span className="flex h-14 w-12 items-center justify-center rounded border border-slate-200 bg-slate-50 text-2xl">🀄</span>
            <h3 className="mt-5 text-2xl font-extrabold text-slate-950">Start with your first club</h3>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">Create a club to manage a roster and record games, or join an existing club using the six-character ID shared by its manager.</p>
            <a href="#club-actions" className="mt-5 inline-flex rounded bg-[rgb(var(--bamboo))] px-4 py-2.5 text-sm font-bold text-white">Create or join a club</a>
          </div>
        )}
      </section>

      <section id="club-actions" className="mt-9 rounded-lg border border-slate-200 bg-white p-5 sm:p-6">
        <div className="grid gap-6 lg:grid-cols-[220px_1fr_1fr] lg:items-end">
          <div><p className="text-xs font-extrabold uppercase tracking-[0.2em] text-slate-500">Grow your table</p><h2 className="mt-2 text-xl font-extrabold text-slate-950">Create or join</h2><p className="mt-2 text-sm leading-5 text-slate-600">Secondary actions when you are ready for another club.</p></div>
          <label className="text-sm font-bold text-slate-700">New club name<div className="mt-2 flex gap-2"><input value={newClubName} onChange={(event) => setNewClubName(event.target.value)} placeholder="Sunday Mahjong" className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-2.5 outline-none focus:border-[rgb(var(--bamboo))]" /><button type="button" onClick={handleCreateClub} disabled={busy || !newClubName.trim()} className="rounded bg-[rgb(var(--bamboo))] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">Create</button></div></label>
          <label className="text-sm font-bold text-slate-700">Existing club ID<div className="mt-2 flex gap-2"><input value={joinClubId} onChange={(event) => setJoinClubId(event.target.value.toUpperCase())} placeholder="ABC123" className="min-w-0 flex-1 rounded border border-slate-300 bg-white px-3 py-2.5 uppercase outline-none focus:border-[rgb(var(--bamboo))]" /><button type="button" onClick={handleJoinClub} disabled={busy || !joinClubId.trim()} className="rounded border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 disabled:opacity-40">Join</button></div></label>
        </div>
        {message ? <p className="mt-4 border-l-4 border-[rgb(var(--gold))] bg-amber-50 px-4 py-3 text-sm font-semibold text-slate-700">{message}</p> : null}
      </section>
    </main>
  )
}