'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSound } from '@/contexts/SoundContext'
import { BrandLockup } from '@/components/BrandMark'
import { FloatingTiles } from '@/components/FloatingTiles'

export default function LoginPage() {
  const router = useRouter()
  const { user, loading, signingIn, authError, signInWithGoogle } = useAuth()
  const { play, unlock } = useSound()
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (!loading && user && !authError) router.replace('/')
  }, [authError, loading, router, user])

  const handleSignIn = async () => {
    setLocalError(null)
    unlock()
    try {
      await signInWithGoogle()
      play('confirmation')
    } catch (error) {
      play('error')
      setLocalError(
        error instanceof Error ? error.message : 'Unable to sign in with Google. Please try again.'
      )
    }
  }

  return (
    <main className="login-welcome">
      <FloatingTiles />
      <div className="login-welcome-grid">
        <section className="login-intro" aria-labelledby="login-title">
          <div className="login-eyebrow">
            <BrandLockup className="brand-lockup-signature" />
          </div>
          <h1 id="login-title">
            <span>Mahjong scoring,</span>
            <span className="login-title-accent">simplified.</span>
          </h1>
          <p className="login-lede">
            A shared scorebook for the people you play with. Run sessions, record results, and see
            the standings take shape over time.
          </p>
          <div className="login-proof-row" aria-label="Product highlights">
            <span>
              <i aria-hidden="true" /> Live table scoring
            </span>
            <span>Offline-safe games</span>
            <span>Custom house rules</span>
          </div>
        </section>
        <section className="login-card" aria-label="Sign in">
          <div className="login-card-heading">
            <div>
              <p className="login-card-kicker">Your table is waiting</p>
              <h2>Welcome back</h2>
            </div>
          </div>
          <p className="login-card-copy">
            Sign in to open your clubs and pick up where the last game ended.
          </p>
          <button
            type="button"
            onClick={handleSignIn}
            disabled={loading || signingIn}
            className="login-google-button"
          >
            <Image
              className="google-mark object-contain p-[3px]"
              src="/google-g.png"
              alt=""
              width={25}
              height={25}
              aria-hidden="true"
            />
            {loading
              ? 'Checking sign-in status…'
              : signingIn
                ? 'Opening Google sign-in…'
                : 'Continue with Google'}
          </button>
          {(localError ?? authError) && (
            <p className="login-error" role="alert">
              {localError ?? authError}
            </p>
          )}
          <p className="login-privacy">
            Your results stay connected to your account so they&apos;re ready on any device.
          </p>
        </section>
        <ul className="login-feature-list" aria-label="Score tracker features">
          <li>
            <span>01</span>
            <div>
              <strong>Run the table</strong>
              <p>Organize players and record each result while the session is live.</p>
            </div>
          </li>
          <li>
            <span>02</span>
            <div>
              <strong>Follow every rivalry</strong>
              <p>Keep game history, points, and experience-aware Skill standings together.</p>
            </div>
          </li>
          <li>
            <span>03</span>
            <div>
              <strong>Bring every club</strong>
              <p>Switch between your Mahjong groups from one personal dashboard.</p>
            </div>
          </li>
        </ul>
      </div>
    </main>
  )
}
