'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  User
} from 'firebase/auth'
import { auth, googleProvider } from '@/lib/firebase'

interface AuthContextValue {
  user: User | null
  loading: boolean
  signingIn: boolean
  authError: string | null
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

function getAuthErrorMessage(error: unknown) {
  const code = (error as { code?: string }).code
  switch (code) {
    case 'auth/popup-blocked':
      return 'Safari blocked the Google sign-in window. Allow pop-ups for this site, then try again.'
    case 'auth/popup-closed-by-user':
      return 'Sign-in was cancelled. Please try again.'
    case 'auth/unauthorized-domain':
      return 'This site is not authorized for sign-in. Add localhost to Firebase Auth authorized domains.'
    case 'auth/operation-not-allowed':
      return 'Google sign-in is not enabled in Firebase Authentication.'
    case 'auth/network-request-failed':
      return 'Network error while signing in. Check your connection and try again.'
    default:
      return error instanceof Error ? error.message : 'Unable to sign in with Google.'
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [signingIn, setSigningIn] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    let active = true

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return

      setLoading(true)
      setUser(nextUser)
      setSigningIn(false)

      try {
        if (nextUser) {
          const enrollmentKey = `mahjong:universal-enrollment:v5:supabase:${nextUser.uid}`
          let alreadyEnrolled = false
          try { alreadyEnrolled = window.sessionStorage.getItem(enrollmentKey) === 'complete' } catch { /* private storage mode */ }
          if (!alreadyEnrolled) {
            const token = await nextUser.getIdToken()
            let enrollment: Response | null = null
            for (let attempt = 0; attempt < 2; attempt += 1) {
              enrollment = await fetch('/api/ensure-universal-membership', {
                method: 'POST',
                headers: { Authorization: 'Bearer ' + token }
              })
              if (enrollment.ok) break
              if (attempt === 0) await new Promise((resolve) => window.setTimeout(resolve, 250))
            }
            if (enrollment?.ok) {
              const result = await enrollment.json() as { tokenRefreshRequired?: boolean }
              if (result.tokenRefreshRequired) await nextUser.getIdToken(true)
              try { window.sessionStorage.setItem(enrollmentKey, 'complete') } catch { /* best-effort cache */ }
            } else {
              throw new Error('We could not prepare your default club. Refresh the page to try again.')
            }
          }
          const tokenResult = await nextUser.getIdTokenResult()
          setIsAdmin(Boolean(tokenResult.claims.admin))
          setAuthError(null)
        } else {
          setIsAdmin(false)
        }
      } catch (error) {
        setIsAdmin(false)
        setAuthError(error instanceof Error ? error.message : 'We could not finish preparing your account. Refresh the page to try again.')
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    })

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    setAuthError(null)
    setSigningIn(true)

    try {
      await signInWithPopup(auth, googleProvider)
    } catch (error) {
      const code = (error as { code?: string }).code
      setSigningIn(false)
      const message = code === 'auth/popup-blocked'
        ? 'Safari blocked the Google sign-in window. Allow pop-ups for this site, then try again.'
        : getAuthErrorMessage(error)
      setAuthError(message)
      throw new Error(message)
    }
  }, [])

  const signOut = useCallback(async () => {
    setAuthError(null)
    await firebaseSignOut(auth)
  }, [])

  const value = useMemo<AuthContextValue>(() => ({
    user,
    loading,
    signingIn,
    authError,
    signInWithGoogle,
    signOut,
    isAdmin
  }), [user, loading, signingIn, authError, signInWithGoogle, signOut, isAdmin])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
