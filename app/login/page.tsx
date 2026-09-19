'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useSound } from '@/contexts/SoundContext'
import { BrandLockup } from '@/components/BrandMark'
import { FloatingTiles } from '@/components/FloatingTiles'
import { writeGuestTableSession } from '@/lib/guest-table-session'
import { guestTableAction } from '@/lib/table-checkin-client'
import LoginFeatureShowcase from '@/components/login/LoginFeatureShowcase'
import SiteFooter from '@/components/SiteFooter'
import { readAgeAttestation, writeAgeAttestation } from '@/lib/cookie-consent'

type GuestStep = 'idle' | 'club' | 'tables'
type ValidatedClub = { clubId: string; clubName: string; tables: number[] }

export default function LoginPage() {
  const router = useRouter()
  const { user, loading, signingIn, authError, signInWithGoogle } = useAuth()
  const { play, unlock } = useSound()
  const [localError, setLocalError] = useState<string | null>(null)
  const [guestStep, setGuestStep] = useState<GuestStep>('idle')
  const [clubCode, setClubCode] = useState('')
  const [validated, setValidated] = useState<ValidatedClub | null>(null)
  const [guestBusy, setGuestBusy] = useState(false)
  const [ageConfirmed, setAgeConfirmed] = useState(false)
  const [ageReady, setAgeReady] = useState(false)

  useEffect(() => {
    if (!loading && user && !authError) router.replace('/')
  }, [authError, loading, router, user])

  useEffect(() => {
    setAgeConfirmed(readAgeAttestation())
    setAgeReady(true)
  }, [])

  const setAge = (checked: boolean) => {
    setAgeConfirmed(checked)
    writeAgeAttestation(checked)
  }

  const handleSignIn = async () => {
    if (!ageConfirmed) {
      setLocalError('Confirm that you are 13 or older to continue.')
      return
    }
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

  const startTryIt = () => {
    if (!ageConfirmed) {
      setLocalError('Confirm that you are 13 or older to continue.')
      return
    }
    setLocalError(null)
    setGuestStep('club')
    setValidated(null)
    setClubCode('')
  }

  const validateClub = async () => {
    setLocalError(null)
    setGuestBusy(true)
    try {
      const result = await guestTableAction<ValidatedClub>('validateClub', {
        clubId: clubCode,
      })
      setValidated(result)
      setGuestStep('tables')
      play('confirmation')
    } catch (error) {
      play('error')
      setLocalError(
        error instanceof Error ? error.message : 'Unable to find that club.'
      )
    } finally {
      setGuestBusy(false)
    }
  }

  const enterTable = async (tableNumber: number) => {
    if (!validated) return
    setLocalError(null)
    setGuestBusy(true)
    try {
      const result = await guestTableAction<{
        token: string
        clubId: string
        clubName: string
        tableNumber: number
      }>('enter', {
        clubId: validated.clubId,
        tableNumber,
      })
      writeGuestTableSession({
        token: result.token,
        clubId: result.clubId,
        clubName: result.clubName,
        tableNumber: result.tableNumber,
      })
      play('confirmation')
      router.replace(
        `/club/${encodeURIComponent(result.clubId)}/table/${result.tableNumber}`,
      )
    } catch (error) {
      play('error')
      setLocalError(
        error instanceof Error ? error.message : 'Unable to open that table.'
      )
      setGuestBusy(false)
    }
  }

  const actionsDisabled = !ageReady || !ageConfirmed || loading || signingIn

  return (
    <div className="login-page">
      <div className="login-welcome">
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
            <a className="login-how-link" href="#how-it-works">
              See how it works
            </a>
          </section>
          <section className="login-card" aria-label="Sign in">
            <div className="login-card-heading">
              <div>
                <p className="login-card-kicker">Your table is waiting</p>
                <h2>{guestStep === 'idle' ? 'Welcome back' : 'Try it'}</h2>
              </div>
            </div>

            {guestStep === 'idle' ? (
              <>
                <p className="login-card-copy">
                  Sign in to open your clubs and pick up where the last game ended.
                </p>
                <label className="login-age-check">
                  <input
                    type="checkbox"
                    checked={ageConfirmed}
                    onChange={(event) => setAge(event.target.checked)}
                    data-tour="login-age-confirm"
                  />
                  <span>I confirm I am 13 years of age or older.</span>
                </label>
                <button
                  type="button"
                  onClick={() => void handleSignIn()}
                  disabled={actionsDisabled}
                  className="login-google-button"
                  data-tour="login-google"
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
                <button
                  type="button"
                  onClick={startTryIt}
                  disabled={actionsDisabled}
                  className="login-try-button"
                  data-tour="login-try-it"
                >
                  Try it
                </button>
                <p className="login-privacy">
                  By continuing you agree to the{' '}
                  <Link href="/terms">Terms of Service</Link> and{' '}
                  <Link href="/privacy">Privacy Policy</Link>. Your results stay connected to your
                  account so they&apos;re ready on any device.
                </p>
              </>
            ) : null}

            {guestStep === 'club' ? (
              <form
                className="login-guest-form"
                onSubmit={(event) => {
                  event.preventDefault()
                  void validateClub()
                }}
              >
                <p className="login-card-copy">
                  Enter the club code, then choose a table that is already open for the session.
                </p>
                <label className="login-guest-label">
                  Club code
                  <input
                    value={clubCode}
                    onChange={(event) => setClubCode(event.target.value.toUpperCase())}
                    maxLength={6}
                    autoComplete="off"
                    spellCheck={false}
                    placeholder="ABC123"
                    className="login-guest-input"
                    data-tour="guest-club-code"
                  />
                </label>
                <div className="login-guest-actions">
                  <button
                    type="button"
                    className="login-guest-secondary"
                    onClick={() => {
                      setGuestStep('idle')
                      setLocalError(null)
                    }}
                    disabled={guestBusy}
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    className="login-guest-primary"
                    disabled={guestBusy || clubCode.trim().length < 3}
                    data-tour="guest-club-continue"
                  >
                    {guestBusy ? 'Checking…' : 'Continue'}
                  </button>
                </div>
              </form>
            ) : null}

            {guestStep === 'tables' && validated ? (
              <div className="login-guest-form">
                <p className="login-card-copy">
                  <strong>{validated.clubName}</strong>
                  {' · '}
                  Choose a table to score.
                </p>
                {validated.tables.length === 0 ? (
                  <p className="login-guest-empty" role="status">
                    No tables available yet. Ask a club member to start a session first.
                  </p>
                ) : (
                  <div className="login-guest-table-grid" role="list">
                    {validated.tables.map((tableNumber) => (
                      <button
                        key={tableNumber}
                        type="button"
                        role="listitem"
                        disabled={guestBusy}
                        onClick={() => void enterTable(tableNumber)}
                        className="login-guest-table-button"
                        data-tour="guest-table-option"
                      >
                        Table {tableNumber}
                      </button>
                    ))}
                  </div>
                )}
                <div className="login-guest-actions">
                  <button
                    type="button"
                    className="login-guest-secondary"
                    onClick={() => {
                      setGuestStep('club')
                      setLocalError(null)
                    }}
                    disabled={guestBusy}
                  >
                    Back
                  </button>
                </div>
              </div>
            ) : null}

            {(localError ?? authError) && (
              <p className="login-error" role="alert">
                {localError ?? authError}
              </p>
            )}
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
      </div>
      <LoginFeatureShowcase />
      <SiteFooter />
    </div>
  )
}
