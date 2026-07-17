'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSound } from '@/contexts/SoundContext'
import { deleteAccount, getAccountDeletionPlan } from '@/lib/data'
import type {
  AccountDeletionPlan,
  AccountManagerResolution,
} from '@/lib/types'

type ResolutionDraft = {
  action: '' | 'transfer' | 'delete'
  successorUid: string
}

export default function UserSettings() {
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { enabled: soundEnabled, toggle: toggleSound } = useSound()
  const [open, setOpen] = useState(false)
  const [deletingMode, setDeletingMode] = useState(false)
  const [darkMode, setDarkMode] = useState(false)
  const [plan, setPlan] = useState<AccountDeletionPlan | null>(null)
  const [resolutions, setResolutions] = useState<Record<string, ResolutionDraft>>({})
  const [confirmationName, setConfirmationName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const contentRef = useRef<HTMLDivElement | null>(null)
  const settingsRootRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    const stored = window.localStorage.getItem('theme')
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches ?? false
    const nextDarkMode = stored ? stored === 'dark' : prefersDark
    setDarkMode(nextDarkMode)
    document.documentElement.classList.toggle('dark', nextDarkMode)
  }, [])

  useEffect(() => {
    if (!open) return
    if (contentRef.current) contentRef.current.scrollTop = 0
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !busy) setOpen(false)
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [busy, deletingMode, open])

  useEffect(() => {
    if (!open) return
    const closeDropdown = (event: PointerEvent) => {
      if (!busy && !settingsRootRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setError(null)
      }
    }
    document.addEventListener('pointerdown', closeDropdown)
    return () => document.removeEventListener('pointerdown', closeDropdown)
  }, [busy, deletingMode, open])

  const toggleTheme = () => {
    const next = !darkMode
    setDarkMode(next)
    document.documentElement.classList.toggle('dark', next)
    window.localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  const beginAccountDeletion = async () => {
    setBusy(true)
    setError(null)
    try {
      const nextPlan = await getAccountDeletionPlan()
      setPlan(nextPlan)
      setResolutions(Object.fromEntries(nextPlan.soleManagerClubs.map((club) => [
        club.clubId,
        { action: '', successorUid: '' },
      ])))
      setConfirmationName('')
      setDeletingMode(true)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to prepare account deletion.')
    } finally {
      setBusy(false)
    }
  }

  const deletionReady = useMemo(() => {
    if (!plan || confirmationName !== plan.confirmationName) return false
    return plan.soleManagerClubs.every((club) => {
      const resolution = resolutions[club.clubId]
      if (resolution?.action === 'transfer') return Boolean(resolution.successorUid)
      if (resolution?.action === 'delete') return !club.universal
      return false
    })
  }, [confirmationName, plan, resolutions])

  const confirmAccountDeletion = async () => {
    if (!plan || !deletionReady) return
    setBusy(true)
    setError(null)
    try {
      const managerResolutions = Object.fromEntries(
        Object.entries(resolutions).map(([clubId, resolution]) => [
          clubId,
          resolution.action === 'transfer'
            ? { action: 'transfer', successorUid: resolution.successorUid }
            : { action: 'delete' },
        ]),
      ) as Record<string, AccountManagerResolution>
      await deleteAccount(confirmationName, managerResolutions)
      try { await signOut() } catch { /* The server already deleted this Firebase identity. */ }
      setOpen(false)
      router.replace('/login')
      router.refresh()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Unable to delete your account safely.')
    } finally {
      setBusy(false)
    }
  }

  const close = () => {
    if (busy) return
    setOpen(false)
    setDeletingMode(false)
    setError(null)
  }

  return (
    <div ref={settingsRootRef} className="relative">
      <button
        type="button"
        onClick={() => { setOpen(true); setDeletingMode(false); setError(null) }}
        aria-label="Open user settings"
        title="Settings"
        className="group flex h-11 w-11 items-center justify-center rounded-full border border-[rgb(var(--line))] bg-[rgb(var(--surface))] text-xl font-black text-[rgb(var(--ink))] shadow-[3px_3px_0_rgb(var(--shadow)/0.08)] hover:border-[rgb(var(--bamboo))]"
      >
        <span aria-hidden="true">&#9881;</span>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/75 px-4 py-6 md:absolute md:inset-auto md:right-0 md:top-[calc(100%+0.75rem)] md:block md:bg-transparent md:p-0" role="dialog" aria-labelledby="user-settings-title" onMouseDown={(event) => { if (event.target === event.currentTarget) close() }}>
          <section className={`flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl md:max-h-[calc(100vh-6rem)] ${deletingMode ? 'md:w-[32rem]' : 'md:w-96'}`}>
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[rgb(var(--bamboo))]">Account</p>
                <h2 id="user-settings-title" className="mt-2 text-xl font-black text-slate-950">{deletingMode ? 'Delete your account' : 'Settings'}</h2>
              </div>
              <button type="button" onClick={close} disabled={busy} aria-label="Close settings" className="rounded border border-slate-300 px-3 py-2 text-sm font-black text-slate-700 disabled:opacity-40">Close</button>
            </header>

            {!deletingMode ? (
              <div ref={contentRef} className="grid flex-1 gap-4 overflow-y-auto p-5">
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                  <p className="font-black text-slate-950">Preferences</p>
                  <div className="mt-3 grid gap-2">
                    <button type="button" onClick={toggleSound} className="flex min-h-12 items-center justify-between rounded border border-slate-300 bg-white px-4 py-3 text-left font-bold text-slate-800">
                      <span>Sound effects</span><span className="text-sm text-slate-500">{soundEnabled ? 'On' : 'Off'}</span>
                    </button>
                    <button type="button" onClick={toggleTheme} className="flex min-h-12 items-center justify-between rounded border border-slate-300 bg-white px-4 py-3 text-left font-bold text-slate-800">
                      <span>Light / dark mode</span><span className="text-sm text-slate-500">{darkMode ? 'Dark' : 'Light'}</span>
                    </button>
                  </div>
                </div>

                {user ? (
                  <>
                    <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
                      <p className="font-black text-slate-950">{user.displayName ?? 'Signed-in user'}</p>
                      <p className="mt-1 text-sm text-slate-500">{user.email}</p>
                      <button type="button" onClick={() => void signOut()} className="mt-4 min-h-11 w-full rounded border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-800 hover:border-[rgb(var(--cinnabar))]">Sign out</button>
                    </div>
                    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4">
                      <p className="font-black text-rose-700">Delete account</p>
                      <p className="mt-1 text-sm leading-6 text-rose-700">Your roster players and their game history will remain in each club, but they will be unlinked from your account. Clubs will not be left without a manager.</p>
                      <button type="button" onClick={beginAccountDeletion} disabled={busy} className="mt-4 min-h-11 rounded bg-rose-700 px-4 py-2 text-sm font-black text-white disabled:opacity-40">{busy ? 'Checking clubs…' : 'Delete my account'}</button>
                    </div>
                  </>
                ) : <p className="rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">Sign in to manage your account.</p>}
                {error ? <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}
              </div>
            ) : plan ? (
              <div ref={contentRef} className="grid flex-1 gap-5 overflow-y-auto p-5">
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-900">
                  <strong className="block">Your player records and games will not be deleted.</strong>
                  Player profiles are unlinked so you can join again and relink after signing in with a new account. Your memberships and personal account profile are removed.
                </div>

                {plan.soleManagerClubs.length ? (
                  <section>
                    <h3 className="font-black text-slate-950">Resolve clubs where you are the only manager</h3>
                    <p className="mt-1 text-sm leading-6 text-slate-600">Assign an active member as manager, or permanently delete a non-universal club and all of that club&apos;s data.</p>
                    <div className="mt-3 grid gap-3">
                      {plan.soleManagerClubs.map((club) => {
                        const draft = resolutions[club.clubId] ?? { action: '', successorUid: '' }
                        return (
                          <div key={club.clubId} className="rounded border border-slate-200 bg-slate-50 p-4">
                            <p className="font-black text-slate-950">{club.clubName}</p>
                            <p className="mt-1 text-xs font-bold uppercase tracking-wide text-slate-500">Club ID {club.clubId}</p>
                            <select value={draft.action} onChange={(event) => setResolutions((current) => ({ ...current, [club.clubId]: { action: event.target.value as ResolutionDraft['action'], successorUid: '' } }))} className="mt-3 min-h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800">
                              <option value="">Choose an action…</option>
                              <option value="transfer">Assign another manager</option>
                              {!club.universal ? <option value="delete">Permanently delete this club</option> : null}
                            </select>
                            {draft.action === 'transfer' ? (
                              club.candidates.length ? (
                                <select value={draft.successorUid} onChange={(event) => setResolutions((current) => ({ ...current, [club.clubId]: { action: 'transfer', successorUid: event.target.value } }))} className="mt-2 min-h-11 w-full rounded border border-slate-300 bg-white px-3 text-sm font-bold text-slate-800">
                                  <option value="">Choose a member…</option>
                                  {club.candidates.map((candidate) => <option key={candidate.uid} value={candidate.uid}>{candidate.displayName || candidate.email || 'Club member'}</option>)}
                                </select>
                              ) : <p className="mt-2 rounded border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-900">No other active member can be assigned yet. Ask someone to join this club first.</p>
                            ) : null}
                            {draft.action === 'delete' ? <p className="mt-2 text-sm font-bold text-rose-700">This deletes the entire club and all club-specific records. It cannot be undone.</p> : null}
                          </div>
                        )
                      })}
                    </div>
                  </section>
                ) : null}

                <label className="text-sm font-black text-slate-800">
                  Type <span className="text-rose-700">{plan.confirmationName}</span> exactly to confirm
                  <input autoComplete="off" value={confirmationName} onChange={(event) => setConfirmationName(event.target.value)} className="mt-2 min-h-11 w-full rounded border border-slate-300 bg-white px-3 text-slate-900 outline-none focus:border-rose-500" />
                </label>
                {error ? <p role="alert" className="rounded border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => { setDeletingMode(false); setError(null) }} disabled={busy} className="min-h-11 rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 disabled:opacity-40">Back</button>
                  <button type="button" onClick={confirmAccountDeletion} disabled={!deletionReady || busy} className="min-h-11 rounded bg-rose-700 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Deleting safely…' : 'Permanently delete account'}</button>
                </div>
              </div>
            ) : null}
          </section>
        </div>
      ) : null}
    </div>
  )
}
