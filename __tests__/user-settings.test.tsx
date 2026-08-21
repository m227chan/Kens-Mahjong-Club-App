import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
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

    expect(screen.getByRole('dialog').className).toContain('user-settings-dialog')
    expect(screen.getByRole('dialog').parentElement?.className).toContain('user-settings-overlay')
    expect(screen.getByRole('dialog').parentElement?.parentElement).toBe(document.body)
    expect(screen.getByRole('heading', { name: 'Account & App Settings' })).toBeTruthy()
    expect(screen.getByText('Preferences')).toBeTruthy()
    expect(screen.getByRole('button', { name: /Sound Effects/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: /Appearance, currently Light/ })).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Sign Out' })).toBeTruthy()

    const deleteRow = screen.getByRole('button', { name: 'Delete Account' })
    expect(deleteRow.className).toContain('app-menu-danger')
    fireEvent.click(deleteRow)
    await screen.findByText('Sunday Mahjong')
    expect(screen.getByRole('dialog').className).toContain('user-settings-dialog')

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

  it('closes with Escape and restores focus to the account trigger', async () => {
    const { container } = render(<UserSettings />)
    const trigger = screen.getByRole('button', { name: 'Account and app settings' })
    fireEvent.click(trigger)
    const dialog = screen.getByRole('dialog')
    const closeButton = screen.getByRole('button', { name: 'Close settings' })
    const deleteRow = screen.getByRole('button', { name: 'Delete Account' })
    expect(dialog).toBeTruthy()
    await waitFor(() => {
      expect(document.activeElement).toBe(closeButton)
      expect(container.hasAttribute('inert')).toBe(true)
    })

    deleteRow.focus()
    fireEvent.keyDown(window, { key: 'Tab' })
    expect(document.activeElement).toBe(closeButton)
    fireEvent.keyDown(window, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(deleteRow)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog')).toBeNull()
    await waitFor(() => {
      expect(document.activeElement).toBe(trigger)
      expect(container.hasAttribute('inert')).toBe(false)
    })
  })

  it('moves focus into account deletion and returns it to the Delete Account row', async () => {
    render(<UserSettings />)
    fireEvent.click(screen.getByRole('button', { name: 'Account and app settings' }))
    const deleteRow = screen.getByRole('button', { name: 'Delete Account' })

    fireEvent.click(deleteRow)
    const deletionTitle = await screen.findByRole('heading', { name: 'Delete Your Account' })
    await waitFor(() => expect(document.activeElement).toBe(deletionTitle))

    fireEvent.click(screen.getByRole('button', { name: 'Back' }))
    const returnedDeleteRow = screen.getByRole('button', { name: 'Delete Account' })
    await waitFor(() => expect(document.activeElement).toBe(returnedDeleteRow))
  })

  it('keeps focus inside the modal while account-deletion checks are pending or fail', async () => {
    let rejectPlan: ((error: Error) => void) | undefined
    mocks.getAccountDeletionPlan.mockReturnValue(new Promise((_resolve, reject) => { rejectPlan = reject }))
    render(<UserSettings />)
    const trigger = screen.getByRole('button', { name: 'Account and app settings' })
    fireEvent.click(trigger)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Account' }))

    const busyStatus = await screen.findByText('Checking club ownership…')
    expect(busyStatus.getAttribute('role')).toBe('status')
    await waitFor(() => expect(document.activeElement).toBe(busyStatus))
    trigger.focus()
    await waitFor(() => expect(document.activeElement).toBe(busyStatus))

    await act(async () => { rejectPlan?.(new Error('Unable to load deletion plan')) })
    const alert = await screen.findByRole('alert')
    expect(alert.textContent).toContain('Unable to load deletion plan')
    await waitFor(() => expect(document.activeElement).toBe(alert))
  })
})
