'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import CameraCoach from '@/components/coach/CameraCoach'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeUserClubs } from '@/lib/data'
import { MAHJONG_CAMERA_COACH_ENABLED } from '@/lib/feature-flags'
import type { ClubMembershipDoc } from '@/lib/types'

export default function CoachPage() {
  const params = useParams<{ clubId: string }>()
  const router = useRouter()
  const { user, loading } = useAuth()
  const [clubs, setClubs] = useState<ClubMembershipDoc[]>([])
  const [loaded, setLoaded] = useState(false)
  const clubId = decodeURIComponent(params.clubId ?? '').toUpperCase()

  useEffect(() => { if (!loading && !user) router.replace('/login') }, [loading, router, user])
  useEffect(() => {
    if (!user) return
    return subscribeUserClubs(user.uid, (next) => { setClubs(next); setLoaded(true) }, () => setLoaded(true))
  }, [user])

  const membership = useMemo(() => clubs.find((club) => club.clubId === clubId) ?? null, [clubId, clubs])

  if (!MAHJONG_CAMERA_COACH_ENABLED) return (
    <main className="mx-auto max-w-xl px-4 py-12"><section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><h1 className="text-2xl font-black text-slate-950">Camera coach beta is disabled</h1><p className="mt-2 text-slate-600">Enable the reviewed production feature flag after device and model acceptance tests pass.</p><Link href={`/club/${clubId}/`} className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2 font-bold text-white">Back to club</Link></section></main>
  )
  if (loading || !user || !loaded) return <main className="min-h-screen bg-[#071d16] p-8 text-center font-bold text-stone-100">Checking club access…</main>
  if (!membership) return <main className="min-h-screen bg-[#071d16] p-8 text-center text-stone-100"><p className="font-bold">Join this club before using its coach.</p><Link href="/" className="mt-4 inline-flex rounded-lg border px-4 py-2">Back home</Link></main>
  return <CameraCoach clubId={clubId} clubName={membership.clubName} />
}

