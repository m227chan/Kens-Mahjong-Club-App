import { act, cleanup, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const firebaseMocks = vi.hoisted(() => ({
  listener: null as null | ((user: unknown) => Promise<void> | void),
  signInWithPopup: vi.fn(),
  signOut: vi.fn()
}))

vi.mock('firebase/auth', () => ({
  onAuthStateChanged: vi.fn((_auth, listener: (user: unknown) => Promise<void> | void) => {
    firebaseMocks.listener = listener
    return vi.fn()
  }),
  signInWithPopup: firebaseMocks.signInWithPopup,
  signOut: firebaseMocks.signOut
}))

vi.mock('@/lib/firebase', () => ({ auth: {}, googleProvider: {} }))

import { AuthProvider, useAuth } from '../contexts/AuthContext'

function AuthState() {
  const { loading, user } = useAuth()
  return <div><span data-testid="loading">{String(loading)}</span><span data-testid="uid">{user?.uid ?? 'none'}</span></div>
}

describe('first-time universal club enrollment', () => {
  beforeEach(() => {
    window.sessionStorage.clear()
    firebaseMocks.listener = null
    vi.restoreAllMocks()
  })

  afterEach(() => cleanup())

  it('gates the dashboard until enrollment and token refresh finish', async () => {
    render(<AuthProvider><AuthState /></AuthProvider>)
    expect(firebaseMocks.listener).not.toBeNull()

    await act(async () => { await firebaseMocks.listener?.(null) })
    expect(screen.getByTestId('loading').textContent).toBe('false')

    let resolveEnrollment: ((response: Response) => void) | undefined
    const enrollmentResponse = new Promise<Response>((resolve) => { resolveEnrollment = resolve })
    vi.stubGlobal('fetch', vi.fn(() => enrollmentResponse))
    const getIdToken = vi.fn(async (_forceRefresh?: boolean) => 'firebase-token')
    const firstTimeUser = {
      uid: 'new-user',
      getIdToken,
      getIdTokenResult: vi.fn(async () => ({ claims: {} }))
    }

    let bootstrap: Promise<void> | void
    await act(async () => {
      bootstrap = firebaseMocks.listener?.(firstTimeUser)
      await Promise.resolve()
    })

    expect(screen.getByTestId('loading').textContent).toBe('true')
    expect(screen.getByTestId('uid').textContent).toBe('new-user')

    resolveEnrollment?.({ ok: true, json: async () => ({ tokenRefreshRequired: true }) } as Response)
    await act(async () => { await bootstrap })

    expect(getIdToken).toHaveBeenCalledWith(true)
    expect(screen.getByTestId('loading').textContent).toBe('false')
    expect(window.sessionStorage.getItem('mahjong:universal-enrollment:v5:supabase:new-user')).toBe('complete')
  })
})
