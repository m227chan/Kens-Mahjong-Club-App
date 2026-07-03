'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { createPlayer } from '@/lib/firestore'

export default function AddPlayerPage() {
  const router = useRouter()
  const { user, loading, isAdmin } = useAuth()
  const [name, setName] = useState('')
  const [icon, setIcon] = useState('🧘')
  const [submitting, setSubmitting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login')
    }
  }, [loading, router, user])

  useEffect(() => {
    if (!loading && user && !isAdmin) {
      setMessage('Only admins can add new players.')
    }
  }, [loading, user, isAdmin])

  const handleSubmit = async () => {
    if (!name.trim()) {
      setMessage('Please enter a player name.')
      return
    }

    if (!isAdmin) {
      setMessage('Only admins can add new players.')
      return
    }

    setSubmitting(true)
    try {
      await createPlayer({ displayName: name.trim(), icon })
      setMessage('Player created.')
      setName('')
      setIcon('🧘')
      router.push('/#session')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to add player.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-2xl items-center justify-center px-4 py-6">
      <div className="w-full rounded-[24px] border border-zinc-200/70 bg-white/80 p-8 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/80">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-blue-500">Add player</p>
        <h1 className="mt-3 text-2xl font-semibold text-zinc-900 dark:text-zinc-100">Welcome a new club member</h1>
        <div className="mt-6 space-y-4">
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Name
            <input value={name} onChange={(event) => setName(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-3 py-3 text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
          </label>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Icon
            <input value={icon} onChange={(event) => setIcon(event.target.value)} className="mt-2 w-full rounded-2xl border border-zinc-300 bg-white px-3 py-3 text-zinc-900 outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100" />
          </label>
          <button onClick={handleSubmit} disabled={submitting} className="w-full rounded-2xl bg-blue-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-blue-400 disabled:opacity-60">
            {submitting ? 'Saving…' : 'Create player'}
          </button>
          {message && <p className="text-sm text-zinc-600 dark:text-zinc-300">{message}</p>}
        </div>
      </div>
    </main>
  )
}
