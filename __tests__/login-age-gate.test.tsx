import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  signInWithGoogle: vi.fn(),
  user: null as null | { uid: string },
  loading: false,
  signingIn: false,
  authError: null as string | null,
}))

const soundMocks = vi.hoisted(() => ({
  play: vi.fn(),
  unlock: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

vi.mock('next/image', () => ({
  default: (props: { alt?: string }) => {
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={props.alt ?? ''} />
  },
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: authMocks.user,
    loading: authMocks.loading,
    signingIn: authMocks.signingIn,
    authError: authMocks.authError,
    signInWithGoogle: authMocks.signInWithGoogle,
  }),
}))

vi.mock('@/contexts/SoundContext', () => ({
  useSound: () => soundMocks,
}))

vi.mock('@/components/BrandMark', () => ({
  BrandLockup: () => <div>Brand</div>,
}))

vi.mock('@/components/FloatingTiles', () => ({
  FloatingTiles: () => null,
}))

vi.mock('@/components/login/LoginFeatureShowcase', () => ({
  default: () => <div>Showcase</div>,
}))

vi.mock('@/lib/table-checkin-client', () => ({
  guestTableAction: vi.fn(),
}))

vi.mock('@/lib/guest-table-session', () => ({
  writeGuestTableSession: vi.fn(),
}))

import LoginPage from '@/app/login/page'

describe('login age gate', () => {
  beforeEach(() => {
    window.localStorage.clear()
    authMocks.signInWithGoogle.mockReset()
    authMocks.user = null
    authMocks.loading = false
    authMocks.signingIn = false
    authMocks.authError = null
    soundMocks.play.mockReset()
    soundMocks.unlock.mockReset()
  })

  afterEach(() => cleanup())

  it('disables Google and Try it until age is confirmed', async () => {
    render(<LoginPage />)

    const google = await screen.findByRole('button', { name: /Continue with Google/i })
    const tryIt = screen.getByRole('button', { name: /^Try it$/i })
    expect(google).toBeDisabled()
    expect(tryIt).toBeDisabled()

    fireEvent.click(screen.getByRole('checkbox', { name: /13 years of age or older/i }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Continue with Google/i })).not.toBeDisabled()
      expect(screen.getByRole('button', { name: /^Try it$/i })).not.toBeDisabled()
    })
  })

  it('persists age confirmation and calls sign-in when enabled', async () => {
    render(<LoginPage />)
    fireEvent.click(screen.getByRole('checkbox', { name: /13 years of age or older/i }))
    fireEvent.click(await screen.findByRole('button', { name: /Continue with Google/i }))

    await waitFor(() => expect(authMocks.signInWithGoogle).toHaveBeenCalledOnce())
    expect(window.localStorage.getItem('mahjong:age-attestation:v1')).toBe('1')
  })
})
