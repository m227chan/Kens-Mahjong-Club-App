'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading, signingIn, authError, signInWithGoogle } = useAuth()
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && user) {
      router.replace('/')
    }
  }, [loading, router, user])

  const handleSignIn = async () => {
    setLocalError(null)
    try {
      await signInWithGoogle()
    } catch (error) {
      setLocalError(error instanceof Error ? error.message : 'Unable to sign in with Google. Please try again.')
    }
  }

  const errorMessage = localError ?? authError

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgb(var(--gold)/0.16),_transparent_58%)] px-4 py-8">
        <div className="w-full max-w-md rounded-[4px] border border-[rgb(var(--line))] bg-[rgb(var(--surface)/0.94)] p-8 text-center shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
          <p className="text-sm text-zinc-600 dark:text-zinc-300">Checking sign-in status...</p>
        </div>
      </main>
    )
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_rgb(var(--gold)/0.16),_transparent_58%)] px-4 py-8">
      <div className="w-full max-w-md rounded-[4px] border border-[rgb(var(--line))] bg-[rgb(var(--surface)/0.94)] p-8 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/80">
        <div className="mb-8 text-center">
          <p className="text-sm font-medium uppercase tracking-[0.2em] text-[rgb(var(--cinnabar))]">Ken&apos;s Mahjong Club</p>
          <h1 className="mt-3 text-3xl font-semibold text-zinc-900 dark:text-zinc-100">Sign in to record games</h1>
          <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-300">Use your Google account to keep score entry secure and synced.</p>
        </div>
        <button
          onClick={handleSignIn}
          disabled={signingIn}
          className="flex w-full items-center justify-center rounded-[4px] bg-[rgb(var(--bamboo))] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[rgb(var(--bamboo-bright))] disabled:cursor-not-allowed disabled:opacity-60 dark:bg-blue-500 dark:hover:bg-blue-400"
        >
          {signingIn ? 'Opening Google sign-in...' : 'Sign in with Google'}
        </button>
        {errorMessage && (
          <p className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300">
            {errorMessage}
          </p>
        )}
      </div>
    </main>
  )
}
