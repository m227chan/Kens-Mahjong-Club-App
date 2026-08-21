'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter } from 'next/navigation'
import MenuGlyph from '@/components/MenuGlyph'
import { useAuth } from '@/contexts/AuthContext'
import { useSound } from '@/contexts/SoundContext'
import { deleteAccount, getAccountDeletionPlan } from '@/lib/data'
import { useModalFocus } from '@/lib/use-modal-focus'
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
  const overlayRef = useRef<HTMLDivElement | null>(null)
  const dialogRef = useRef<HTMLElement | null>(null)
  const closeButtonRef = useRef<HTMLButtonElement | null>(null)
  const deleteRowRef = useRef<HTMLButtonElement | null>(null)
  const deletionTitleRef = useRef<HTMLHeadingElement | null>(null)
  const busyStatusRef = useRef<HTMLParagraphElement | null>(null)
  const errorRef = useRef<HTMLParagraphElement | null>(null)
  const busyRef = useRef(busy)
  busyRef.current = busy
  const wasDeletingModeRef = useRef(false)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const accountInitials = useMemo(() => {
    const displayName = user?.displayName?.trim()
    if (displayName) {
      const parts = displayName.split(/\s+/).filter(Boolean)
      return ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)?.[0] ?? '' : '')).toUpperCase()
    }
    const emailName = user?.email?.split('@')[0] ?? ''
    const parts = emailName.split(/[._\-\s]+/).filter(Boolean)
    const initials = ((parts[0]?.[0] ?? '') + (parts.length > 1 ? parts.at(-1)?.[0] ?? '' : '')).toUpperCase()
    return initials || 'U'
  }, [user?.displayName, user?.email])

  const close = useCallback(() => {
    if (busy) return
    setOpen(false)
    setDeletingMode(false)
    setError(null)
    window.requestAnimationFrame(() => triggerRef.current?.focus())
  }, [busy])

  const getInitialFocus = useCallback(
    () => busyRef.current ? busyStatusRef.current : closeButtonRef.current,
    [],
  )

  useModalFocus({
    open,
    layerRef: overlayRef,
    dialogRef,
    getInitialFocus,
    onEscape: close,
    escapeDisabled: busy,
  })

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
  }, [deletingMode, open])

  useEffect(() => {
    if (!open || !busy) return
    const frame = window.requestAnimationFrame(() => busyStatusRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [busy, open])

  useEffect(() => {
    if (!open) {
      wasDeletingModeRef.current = false
      return
    }
    const wasDeleting = wasDeletingModeRef.current
    wasDeletingModeRef.current = deletingMode
    if (wasDeleting === deletingMode) return
    const frame = window.requestAnimationFrame(() => {
      if (deletingMode) deletionTitleRef.current?.focus()
      else deleteRowRef.current?.focus()
    })
    return () => window.cancelAnimationFrame(frame)
  }, [deletingMode, open])

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    const syncVisualViewport = () => {
      const overlay = overlayRef.current
      if (!overlay) return
      const viewport = window.visualViewport
      overlay.style.setProperty('--settings-viewport-height', `${Math.round(viewport?.height ?? window.innerHeight)}px`)
      overlay.style.setProperty('--settings-viewport-top', `${Math.round(viewport?.offsetTop ?? 0)}px`)
    }
    document.body.style.overflow = 'hidden'
    syncVisualViewport()
    window.addEventListener('resize', syncVisualViewport)
    window.visualViewport?.addEventListener('resize', syncVisualViewport)
    window.visualViewport?.addEventListener('scroll', syncVisualViewport)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('resize', syncVisualViewport)
      window.visualViewport?.removeEventListener('resize', syncVisualViewport)
      window.visualViewport?.removeEventListener('scroll', syncVisualViewport)
    }
  }, [open])

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
      window.requestAnimationFrame(() => errorRef.current?.focus())
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
      window.requestAnimationFrame(() => errorRef.current?.focus())
    } finally {
      setBusy(false)
    }
  }

  if (!user) return null

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => { if (open) close(); else { setOpen(true); setDeletingMode(false); setError(null) } }}
        aria-label="Account and app settings"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Account & App Settings"
        className="header-action-button group flex h-11 w-11 items-center justify-center rounded-full border border-[rgb(var(--bamboo-bright))] bg-[rgb(var(--bamboo))] text-sm font-black tracking-[0.04em] text-white shadow-[3px_3px_0_rgb(var(--shadow)/0.08)] transition hover:bg-[rgb(var(--bamboo-bright))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--gold))] focus-visible:ring-offset-2"
      >
        <span aria-hidden="true">{accountInitials}</span>
      </button>

      {open && typeof document !== 'undefined' ? createPortal(
        <div
          ref={overlayRef}
          className="user-settings-overlay"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !busy && !deletingMode) close()
          }}
        >
          <section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="user-settings-title"
            tabIndex={-1}
            className={`user-settings-dialog flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white shadow-2xl ${deletingMode ? 'is-deleting w-[min(32rem,calc(100vw-2.5rem))]' : 'w-[min(24rem,calc(100vw-2.5rem))]'}`}
          >
            <header className="flex items-start justify-between gap-4 border-b border-slate-200 p-5">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[rgb(var(--bamboo))]">Account</p>
                <h2 ref={deletionTitleRef} id="user-settings-title" tabIndex={deletingMode ? -1 : undefined} className="mt-2 text-xl font-black text-slate-950">{deletingMode ? 'Delete Your Account' : 'Account & App Settings'}</h2>
                <p
                  ref={busyStatusRef}
                  role="status"
                  tabIndex={busy ? 0 : -1}
                  className="sr-only"
                >
                  {busy ? deletingMode ? 'Deleting account…' : 'Checking club ownership…' : ''}
                </p>
              </div>
              <button ref={closeButtonRef} type="button" onClick={close} disabled={busy} aria-label="Close settings" className="min-h-11 min-w-11 rounded border border-slate-300 px-3 py-2 text-sm font-black text-slate-700 disabled:opacity-40">Close</button>
            </header>

            {!deletingMode ? (
              <div ref={contentRef} className="user-settings-menu min-h-0 flex-1 overflow-y-auto overscroll-contain">
                <div className="app-menu-list">
                  <section aria-labelledby="user-preferences-label">
                    <h3 id="user-preferences-label" className="app-menu-group-label">Preferences</h3>
                    <div className="app-menu-group">
                      <button type="button" aria-pressed={soundEnabled} onClick={toggleSound} className="app-menu-row">
                        <MenuGlyph name="sound" />
                        <span className="app-menu-row-copy">
                          <strong>Sound Effects</strong>
                          <small>Play feedback for game and menu actions</small>
                        </span>
                        <span className="app-menu-trailing">
                          {soundEnabled ? 'On' : 'Off'}
                          <span className="app-menu-check" aria-hidden="true">✓</span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Appearance, currently ${darkMode ? 'Dark' : 'Light'}`}
                        aria-pressed={darkMode}
                        onClick={toggleTheme}
                        className="app-menu-row"
                      >
                        <MenuGlyph name="appearance" />
                        <span className="app-menu-row-copy">
                          <strong>Appearance</strong>
                          <small>Choose the app color scheme</small>
                        </span>
                        <span className="app-menu-trailing">
                          {darkMode ? 'Dark' : 'Light'}
                          <span className="app-menu-check" aria-hidden="true">✓</span>
                        </span>
                      </button>
                    </div>
                  </section>

                  <section aria-labelledby="signed-in-account-label">
                    <h3 id="signed-in-account-label" className="app-menu-group-label">Signed in</h3>
                    <div className="app-menu-group">
                      <div className="app-menu-row user-settings-account-row">
                        <MenuGlyph name="account" />
                        <span className="app-menu-row-copy">
                          <strong>{user.displayName ?? 'Signed-in user'}</strong>
                          <small>{user.email}</small>
                        </span>
                      </div>
                      <button type="button" onClick={() => void signOut()} className="app-menu-row">
                        <MenuGlyph name="sign-out" />
                        <span className="app-menu-row-copy"><strong>Sign Out</strong></span>
                      </button>
                    </div>
                  </section>

                  <section aria-labelledby="account-management-label">
                    <h3 id="account-management-label" className="app-menu-group-label">Account management</h3>
                    <div className="app-menu-group">
                      <button
                        ref={deleteRowRef}
                        type="button"
                        onClick={beginAccountDeletion}
                        disabled={busy}
                        aria-label="Delete Account"
                        className="app-menu-row app-menu-danger"
                      >
                        <MenuGlyph name="delete" />
                        <span className="app-menu-row-copy">
                          <strong>{busy ? 'Checking Clubs…' : 'Delete Account…'}</strong>
                          <small>Review club ownership before permanent deletion</small>
                        </span>
                        <span className="app-menu-trailing" aria-hidden="true"><span className="app-menu-chevron" /></span>
                      </button>
                    </div>
                  </section>

                  {error ? <p ref={errorRef} role="alert" tabIndex={-1} className="rounded border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}
                </div>
              </div>
            ) : plan ? (
              <div ref={contentRef} className="grid min-h-0 flex-1 gap-5 overflow-y-auto overscroll-contain p-5">
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
                {error ? <p ref={errorRef} role="alert" tabIndex={-1} className="rounded border border-rose-200 bg-rose-50 p-3 text-sm font-bold text-rose-700">{error}</p> : null}
                <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                  <button type="button" onClick={() => { setDeletingMode(false); setError(null) }} disabled={busy} className="min-h-11 rounded border border-slate-300 px-4 py-2 text-sm font-black text-slate-700 disabled:opacity-40">Back</button>
                  <button type="button" onClick={confirmAccountDeletion} disabled={!deletionReady || busy} className="min-h-11 rounded bg-rose-700 px-4 py-2 text-sm font-black text-white disabled:cursor-not-allowed disabled:opacity-40">{busy ? 'Deleting safely…' : 'Permanently delete account'}</button>
                </div>
              </div>
            ) : null}
          </section>
        </div>,
        document.body,
      ) : null}
    </div>
  )
}
