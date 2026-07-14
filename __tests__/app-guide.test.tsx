import '@testing-library/jest-dom/vitest'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppGuide, { TOUR_STEP_COUNT } from '@/components/AppGuide'

const push = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push })
}))

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({ user: { uid: 'tour-user' } })
}))

describe('AppGuide', () => {
  beforeEach(() => {
    push.mockClear()
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({
      x: 20, y: 20, top: 20, left: 20, right: 320, bottom: 100,
      width: 300, height: 80, toJSON: () => ({})
    } as DOMRect)
    HTMLElement.prototype.scrollIntoView = vi.fn()
  })
  afterEach(() => cleanup())

  it('presents the signed-in workflow in order', () => {
    render(<AppGuide />)
    fireEvent.click(screen.getByRole('button', { name: 'Open app guide' }))

    expect(screen.getByRole('heading', { name: 'How the score tracker works' })).toBeInTheDocument()
    expect(screen.getByText('Start on your dashboard')).toBeInTheDocument()
    expect(screen.getByText('What is a Session?')).toBeInTheDocument()
    expect(screen.getByText('Fan Scoring')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Fan' })).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Base points' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: '13+' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Take a Tour/ })).toBeInTheDocument()
  })

  it('spotlights real application elements and exits to the dashboard', async () => {
    render(<><div data-tour="dashboard-intro">Real dashboard</div><AppGuide /></>)
    fireEvent.click(screen.getByRole('button', { name: 'Open app guide' }))
    fireEvent.click(screen.getByRole('button', { name: /Take a Tour/ }))

    expect(TOUR_STEP_COUNT).toBe(20)
    expect(screen.getByText('Your personal dashboard')).toBeInTheDocument()
    await waitFor(() => expect(document.querySelector('.real-tour-spotlight')).toBeInTheDocument())
    expect(screen.getByText('Real dashboard')).toBeInTheDocument()
    expect(document.querySelector('.real-tour-layer')).toBeInTheDocument()

    fireEvent.click(screen.getByText('Exit tour'))
    expect(push).toHaveBeenCalledWith('/')
    expect(screen.queryByText('Your personal dashboard')).not.toBeInTheDocument()
  })
})
