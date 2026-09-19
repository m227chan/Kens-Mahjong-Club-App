import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import CookieConsentBanner from '@/components/CookieConsentBanner'
import { COOKIE_CONSENT_STORAGE_KEY } from '@/lib/cookie-consent'

describe('CookieConsentBanner', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    cleanup()
    window.localStorage.clear()
  })

  it('shows until a choice is saved, then hides', async () => {
    render(<CookieConsentBanner />)
    expect(await screen.findByRole('dialog', { name: /Cookies/i })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /^Accept$/i }))

    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: /Cookies/i })).not.toBeInTheDocument()
    })
    expect(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBe('accepted')
  })

  it('stores essential-only preference', async () => {
    render(<CookieConsentBanner />)
    fireEvent.click(await screen.findByRole('button', { name: /Essential only/i }))
    await waitFor(() => {
      expect(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBe('essential')
    })
  })
})
