import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PlayerDoc, SessionDoc } from '@/lib/types'

const { playMock, subscribeActiveSessionMock, tableActionMock } = vi.hoisted(() => ({
  playMock: vi.fn(),
  subscribeActiveSessionMock: vi.fn(),
  tableActionMock: vi.fn(),
}))

const players = [
  { id: 'jane', displayName: 'Jane', icon: '🐎', authUid: 'user-1', title: '', active: true },
  { id: 'bob', displayName: 'Bob', icon: '🏆', authUid: null, title: '', active: true },
] as PlayerDoc[]

const activeSession = {
  id: 'session-1',
  seasonNumber: 1,
  tableCount: 1,
  participants: ['jane', 'bob'],
  tables: { '1': ['jane'] },
  sideline: ['bob'],
  isActive: true,
} as unknown as SessionDoc

vi.mock('next/navigation', () => ({ useRouter: () => ({ replace: vi.fn() }) }))
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'user-1' }, loading: false, isAdmin: false }),
}))
vi.mock('@/contexts/SoundContext', () => ({
  useSound: () => ({ play: playMock }),
}))
vi.mock('@/contexts/GameSyncContext', () => ({
  useGameSync: () => ({ saveGame: vi.fn() }),
}))
vi.mock('@/lib/data', () => ({
  closeSession: vi.fn(),
  createGame: vi.fn(),
  createSession: vi.fn(),
  subscribeActiveSession: subscribeActiveSessionMock,
  subscribePlayers: vi.fn(() => () => undefined),
  updateSession: vi.fn(),
}))
vi.mock('@/lib/table-checkin-client', () => ({
  getQrEnrollmentSetting: vi.fn(),
  setQrEnrollmentSetting: vi.fn(),
  tableAction: tableActionMock,
}))

import SessionManager from '@/components/SessionManager'

describe('session manager optimistic table changes', () => {
  afterEach(() => {
    cleanup()
    playMock.mockReset()
    tableActionMock.mockReset()
    subscribeActiveSessionMock.mockReset()
  })

  it('removes a player before the database request resolves', async () => {
    subscribeActiveSessionMock.mockImplementation(
      (_clubId: string, _seasonNumber: number, onValue: (session: SessionDoc) => void) => {
        onValue(activeSession)
        return () => undefined
      },
    )
    let finishMutation: ((value: { status: 'ok'; session: typeof activeSession }) => void) | undefined
    tableActionMock.mockImplementation(() => new Promise((resolve) => { finishMutation = resolve }))

    render(
      <SessionManager
        clubId="TEST"
        seasonNumber={1}
        players={players}
      />,
    )

    fireEvent.click(await screen.findByRole('button', { name: 'Move Jane to the sideline' }))

    expect(screen.queryByRole('button', { name: 'Move Jane to the sideline' })).toBeNull()
    expect(document.getElementById('sidelineArea')?.textContent).toContain('Jane')
    await waitFor(() =>
      expect(tableActionMock).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'remove',
          playerId: 'jane',
          tableNumber: 1,
        }),
      ),
    )

    finishMutation?.({
      status: 'ok',
      session: {
        ...activeSession,
        tables: { '1': [] },
        sideline: ['bob', 'jane'],
      },
    })
    await waitFor(() => expect(document.getElementById('sidelineArea')?.textContent).toContain('Jane'))
  }, 10_000)
})
