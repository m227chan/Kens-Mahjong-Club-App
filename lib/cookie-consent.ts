export type CookieConsentChoice = 'accepted' | 'essential'

export const COOKIE_CONSENT_STORAGE_KEY = 'mahjong:cookie-consent:v1'
export const AGE_ATTESTATION_STORAGE_KEY = 'mahjong:age-attestation:v1'

export function readCookieConsent(): CookieConsentChoice | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(COOKIE_CONSENT_STORAGE_KEY)
    if (raw === 'accepted' || raw === 'essential') return raw
    return null
  } catch {
    return null
  }
}

export function writeCookieConsent(choice: CookieConsentChoice) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(COOKIE_CONSENT_STORAGE_KEY, choice)
  } catch {
    /* Privacy mode may block storage. */
  }
}

export function allowsPreferenceStorage(choice: CookieConsentChoice | null): boolean {
  return choice === 'accepted'
}

export function readAgeAttestation(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(AGE_ATTESTATION_STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

export function writeAgeAttestation(confirmed: boolean) {
  if (typeof window === 'undefined') return
  try {
    if (confirmed) window.localStorage.setItem(AGE_ATTESTATION_STORAGE_KEY, '1')
    else window.localStorage.removeItem(AGE_ATTESTATION_STORAGE_KEY)
  } catch {
    /* Privacy mode may block storage. */
  }
}
