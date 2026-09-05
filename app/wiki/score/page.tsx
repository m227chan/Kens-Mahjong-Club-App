'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import HandScoringCalculator from '@/components/hand-scoring/HandScoringCalculator'

function WikiScoreContent() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const clubId = searchParams.get('club')

  useEffect(() => {
    if (!loading && !user) router.replace('/login')
  }, [loading, user, router])

  if (loading || !user) {
    return (
      <main className="wiki-page-shell">
        <p className="wiki-page-intro">Loading score calculator…</p>
      </main>
    )
  }

  return (
    <main className="wiki-page-shell">
      <header className="wiki-page-header">
        <Link href={clubId ? `/wiki?club=${encodeURIComponent(clubId)}` : '/wiki'} className="wiki-back-link">
          ← Back to wiki
        </Link>
        <h1>Score Calculator</h1>
        <p className="wiki-page-intro">
          Build melds, set winds and flowers, and calculate fan under your club&apos;s house scoring rules.
        </p>
      </header>
      <HandScoringCalculator clubId={clubId ? decodeURIComponent(clubId) : null} />
    </main>
  )
}

export default function WikiScorePage() {
  return (
    <Suspense fallback={<main className="wiki-page-shell"><p className="wiki-page-intro">Loading score calculator…</p></main>}>
      <WikiScoreContent />
    </Suspense>
  )
}
