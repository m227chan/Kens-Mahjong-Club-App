'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import {
  getRedirectResult,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
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
      return 'Your browser blocked the sign-in popup. Trying redirect instead...'
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

    getRedirectResult(auth)
      .catch((error) => {
        if (active) {
          setAuthError(getAuthErrorMessage(error))
        }
      })

    const unsubscribe = onAuthStateChanged(auth, async (nextUser) => {
      if (!active) return

      setUser(nextUser)
      setSigningIn(false)

      try {
        if (nextUser) {
          const tokenResult = await nextUser.getIdTokenResult()
          setIsAdmin(Boolean(tokenResult.claims.admin))
          setAuthError(null)
        } else {
          setIsAdmin(false)
        }
      } catch {
        setIsAdmin(false)
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
      if (code === 'auth/popup-blocked') {
        await signInWithRedirect(auth, googleProvider)
        return
      }

      setSigningIn(false)
      setAuthError(getAuthErrorMessage(error))
      throw error
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
