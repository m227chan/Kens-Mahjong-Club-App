'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import ClubWorkspace from '@/components/ClubWorkspace'
import { useAuth } from '@/contexts/AuthContext'
import { subscribeUserClubs } from '@/lib/firestore'
import type { ClubMembershipDoc } from '@/lib/types'

export default function ClubPage() {
  const params = useParams<{ clubId: string }>()
  const router = useRouter()
  const { user, loading } = useAuth()
  const [clubs, setClubs] = useState<ClubMembershipDoc[]>([])
  const [clubsLoaded, setClubsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const clubId = decodeURIComponent(params.clubId ?? '').toUpperCase()

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
        setError(null)
        setClubs(nextClubs)
        setClubsLoaded(true)
      },
      (nextError) => {
        setClubsLoaded(true)
        setError(nextError.message)
      }
    )
  }, [user])

  const membership = useMemo(() => {
    return clubs.find((club) => club.clubId === clubId) ?? null
  }, [clubId, clubs])

  if (loading || !user || !clubsLoaded) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center px-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4 text-sm font-semibold text-slate-600 shadow-sm">
          Loading club...
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <section className="rounded-lg border border-rose-200 bg-white p-6 shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-rose-600">Unable to load club</p>
          <h1 className="mt-3 text-2xl font-black text-slate-950">Permission check failed</h1>
          <p className="mt-2 text-sm text-slate-600">{error}</p>
          <Link href="/" className="mt-5 inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white">
            Back to homepage
          </Link>
        </section>
      </main>
    )
  }

  if (!membership) {
    return (
      <main className="mx-auto max-w-2xl px-4 py-10">
        <section className="rounded-lg border border-slate-200 bg-white p-6 text-center shadow-sm">
          <p className="text-sm font-black uppercase tracking-[0.16em] text-slate-500">Club unavailable</p>
          <h1 className="mt-3 text-2xl font-black text-slate-950">You are not in {clubId}</h1>
          <p className="mt-2 text-sm text-slate-600">Join this club from the homepage or ask the manager to approve your request.</p>
          <Link href="/" className="mt-5 inline-flex rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white">
            Back to homepage
          </Link>
        </section>
      </main>
    )
  }

  return <ClubWorkspace clubId={clubId} membership={membership} />
}
