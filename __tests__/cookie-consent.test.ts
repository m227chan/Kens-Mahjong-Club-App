import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  AGE_ATTESTATION_STORAGE_KEY,
  COOKIE_CONSENT_STORAGE_KEY,
  allowsPreferenceStorage,
  readAgeAttestation,
  readCookieConsent,
  writeAgeAttestation,
  writeCookieConsent,
} from '@/lib/cookie-consent'

describe('cookie consent helpers', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    window.localStorage.clear()
  })

  it('returns null until a choice is stored', () => {
    expect(readCookieConsent()).toBeNull()
    expect(allowsPreferenceStorage(null)).toBe(false)
  })

  it('persists accept and essential choices', () => {
    writeCookieConsent('accepted')
    expect(window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)).toBe('accepted')
    expect(readCookieConsent()).toBe('accepted')
    expect(allowsPreferenceStorage('accepted')).toBe(true)

    writeCookieConsent('essential')
    expect(readCookieConsent()).toBe('essential')
    expect(allowsPreferenceStorage('essential')).toBe(false)
  })

  it('ignores unknown stored values', () => {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, 'maybe')
    expect(readCookieConsent()).toBeNull()
  })

  it('persists age attestation', () => {
    expect(readAgeAttestation()).toBe(false)
    writeAgeAttestation(true)
    expect(window.localStorage.getItem(AGE_ATTESTATION_STORAGE_KEY)).toBe('1')
    expect(readAgeAttestation()).toBe(true)
    writeAgeAttestation(false)
    expect(readAgeAttestation()).toBe(false)
  })
})
