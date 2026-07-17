import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  deleteAccount: vi.fn(),
  getAccountDeletionPlan: vi.fn(),
  signOut: vi.fn(),
  toggleSound: vi.fn(),
  replace: vi.fn(),
  refresh: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mocks.replace, refresh: mocks.refresh }),
}))
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { displayName: 'Matthew Chan', email: 'matt@example.com' },
    signOut: mocks.signOut,
  }),
}))
vi.mock('@/contexts/SoundContext', () => ({
  useSound: () => ({ enabled: true, toggle: mocks.toggleSound }),
}))
vi.mock('@/lib/data', () => ({
  deleteAccount: mocks.deleteAccount,
  getAccountDeletionPlan: mocks.getAccountDeletionPlan,
}))

import UserSettings from '@/components/UserSettings'

describe('user settings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.clear()
    mocks.getAccountDeletionPlan.mockResolvedValue({
      confirmationName: 'Matthew Chan',
      soleManagerClubs: [{
        clubId: 'ABC123',
        clubName: 'Sunday Mahjong',
        universal: false,
        candidates: [{ uid: 'next-manager', displayName: 'Jamie', email: 'jamie@example.com' }],
      }],
    })
    mocks.deleteAccount.mockResolvedValue(undefined)
    mocks.signOut.mockResolvedValue(undefined)
  })

  afterEach(() => cleanup())

  it('consolidates preferences and requires a valid manager handoff plus exact name', async () => {
    render(<UserSettings />)
    const settingsButton = screen.getByRole('button', { name: 'Account and app settings' })
    expect(settingsButton.textContent).toBe('MC')
    fireEvent.click(settingsButton)

    expect(screen.getByRole('dialog').className).toContain('absolute')
    expect(screen.getByRole('heading', { name: 'Account & app settings' })).toBeTruthy()
    expect(screen.getByText('Preferences')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sound effects/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Light \/ dark mode/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign out' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Delete my account' }))
    await screen.findByText('Sunday Mahjong')
    expect(screen.getByRole('dialog').className).toContain('absolute')

    const finalButton = screen.getByRole('button', { name: 'Permanently delete account' }) as HTMLButtonElement
    expect(finalButton.disabled).toBe(true)

    fireEvent.change(screen.getByDisplayValue('Choose an action…'), { target: { value: 'transfer' } })
    fireEvent.change(screen.getByDisplayValue('Choose a member…'), { target: { value: 'next-manager' } })
    fireEvent.change(screen.getByLabelText(/Type Matthew Chan exactly/), { target: { value: 'Matthew Chan' } })

    expect(finalButton.disabled).toBe(false)
    fireEvent.click(finalButton)
    await waitFor(() => expect(mocks.deleteAccount).toHaveBeenCalledWith('Matthew Chan', {
      ABC123: { action: 'transfer', successorUid: 'next-manager' },
    }))
  })
})
