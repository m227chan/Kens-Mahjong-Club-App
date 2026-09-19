'use client'

import { useEffect, useId, useState } from 'react'
import Link from 'next/link'
import {
  type CookieConsentChoice,
  readCookieConsent,
  writeCookieConsent,
} from '@/lib/cookie-consent'

export default function CookieConsentBanner() {
  const titleId = useId()
  const [choice, setChoice] = useState<CookieConsentChoice | null | undefined>(undefined)
  const [manageOpen, setManageOpen] = useState(false)

  useEffect(() => {
    setChoice(readCookieConsent())
  }, [])

  if (choice === undefined || choice !== null) return null

  const save = (next: CookieConsentChoice) => {
    writeCookieConsent(next)
    setChoice(next)
    setManageOpen(false)
  }

  return (
    <div
      className="cookie-consent-banner"
      role="dialog"
      aria-modal="false"
      aria-labelledby={titleId}
    >
      <div className="cookie-consent-inner">
        <div className="cookie-consent-copy">
          <h2 id={titleId}>Cookies &amp; local storage</h2>
          <p>
            We use essential sign-in storage and optional preference storage (sound, offline queue,
            layout). We do not use ad trackers today.{' '}
            <Link href="/cookies">Cookie Policy</Link>
          </p>
          {manageOpen ? (
            <ul className="cookie-consent-categories">
              <li>
                <strong>Essential</strong> — Firebase auth and core scoring. Always on.
              </li>
              <li>
                <strong>Preferences</strong> — Remembers non-essential client settings. Optional.
              </li>
            </ul>
          ) : null}
        </div>
        <div className="cookie-consent-actions">
          <button
            type="button"
            className="cookie-consent-secondary"
            onClick={() => setManageOpen((open) => !open)}
          >
            {manageOpen ? 'Hide details' : 'Manage'}
          </button>
          <button
            type="button"
            className="cookie-consent-secondary"
            onClick={() => save('essential')}
          >
            Essential only
          </button>
          <button
            type="button"
            className="cookie-consent-primary"
            onClick={() => save('accepted')}
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  )
}
