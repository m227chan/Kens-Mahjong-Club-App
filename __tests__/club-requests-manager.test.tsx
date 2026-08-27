import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import ClubRequestsManager from '@/components/ClubRequestsManager'
import { Timestamp } from '@/lib/timestamp'
import type { ClubDoc, JoinRequestDoc } from '@/lib/types'

const dataMocks = vi.hoisted(() => ({
  updateClubJoinApproval: vi.fn(),
}))

vi.mock('@/lib/data', () => dataMocks)

const club: ClubDoc = {
  id: 'CLUB1',
  name: 'Test Club',
  managerUid: 'manager-1',
  managerEmail: 'manager@example.com',
  managerDisplayName: 'Manager',
  createdAt: Timestamp.now(),
  active: true,
  universal: false,
  joinApprovalRequired: true,
}

const request: JoinRequestDoc = {
  id: 'member-1',
  clubId: 'CLUB1',
  uid: 'member-1',
  email: 'member@example.com',
  displayName: 'New Member',
  status: 'pending',
  createdAt: Timestamp.now(),
}

describe('club requests manager', () => {
  afterEach(() => {
    cleanup()
    vi.clearAllMocks()
  })

  it('shows pending members and sends accept or deny decisions', () => {
    const onResolve = vi.fn()
    render(<ClubRequestsManager open club={club} requests={[request]} resolvingUid={null} notice={null} onClose={vi.fn()} onResolve={onResolve} />)

    expect(screen.getByRole('heading', { name: 'Join requests' })).toBeTruthy()
    expect(screen.getByText('New Member')).toBeTruthy()
    expect(screen.getByText('1 pending')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Accept' }))
    expect(onResolve).toHaveBeenCalledWith(request, true)
    fireEvent.click(screen.getByRole('button', { name: 'Deny' }))
    expect(onResolve).toHaveBeenCalledWith(request, false)
  })

  it('lets a manager turn approval off and explains instant joining', async () => {
    dataMocks.updateClubJoinApproval.mockResolvedValue(undefined)
    render(<ClubRequestsManager open club={club} requests={[]} resolvingUid={null} notice={null} onClose={vi.fn()} onResolve={vi.fn()} />)

    const policy = screen.getByRole('switch', { name: 'Require manager approval' })
    expect(policy.getAttribute('aria-checked')).toBe('true')
    fireEvent.click(policy)

    expect(policy.getAttribute('aria-checked')).toBe('false')
    await waitFor(() => expect(dataMocks.updateClubJoinApproval).toHaveBeenCalledWith('CLUB1', false))
    expect(screen.getByRole('switch', { name: 'Require manager approval' }).className).not.toContain('is-on')
    expect(screen.getByText('Off')).toBeTruthy()
    expect(await screen.findByText('Anyone with the club ID can now join instantly.')).toBeTruthy()
    expect(screen.getByText('No pending requests')).toBeTruthy()
  })
})
