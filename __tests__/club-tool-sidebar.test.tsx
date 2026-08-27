import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ClubToolSidebar from '@/components/ClubToolSidebar'

function mockViewport(mobile: boolean) {
  vi.stubGlobal('matchMedia', vi.fn((query: string) => ({
    matches: query === '(max-width: 767px)' ? mobile : !mobile,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })))
}

function sidebarProps() {
  return {
    expanded: true,
    onExpandedChange: vi.fn(),
    rosterOpen: false,
    analyticsOpen: true,
    gameLogsOpen: false,
    networkOpen: false,
    settingsOpen: false,
    requestsOpen: false,
    onRoster: vi.fn(),
    onAnalytics: vi.fn(),
    onGameLogs: vi.fn(),
    onNetwork: vi.fn(),
    onSettings: vi.fn(),
    onRequests: vi.fn(),
    showJoinRequests: true,
    pendingRequestCount: 2,
  }
}

describe('club tool sidebar', () => {
  beforeEach(() => {
    document.body.style.overflow = ''
  })

  afterEach(() => {
    cleanup()
    vi.unstubAllGlobals()
    document.body.style.overflow = ''
  })

  it('groups concise desktop destinations and keeps the sidebar open when a tool is chosen', async () => {
    mockViewport(false)
    const props = sidebarProps()
    render(<ClubToolSidebar {...props} />)

    expect(screen.getByRole('complementary', { name: 'Club navigation' })).toBeTruthy()
    expect(screen.getByText('Explore')).toBeTruthy()
    expect(screen.getByText('Manage')).toBeTruthy()
    expect(screen.getByText('Scores, Skill, and records')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Join requests' })).toBeTruthy()
    expect(screen.getByLabelText('2 pending')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Analytics' }).getAttribute('aria-expanded')).toBe('true')

    fireEvent.click(screen.getByRole('button', { name: 'Analytics' }))

    expect(props.onAnalytics).toHaveBeenCalledOnce()
    expect(props.onExpandedChange).not.toHaveBeenCalled()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Collapse club tools' })).toBeTruthy())
  })

  it('behaves as a dismissible mobile drawer and closes after navigation', async () => {
    mockViewport(true)
    const props = sidebarProps()
    render(<ClubToolSidebar {...props} />)

    await waitFor(() => expect(screen.getByRole('button', { name: 'Close club tools' })).toBeTruthy())
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.click(screen.getByRole('button', { name: 'Analytics' }))
    expect(props.onExpandedChange).toHaveBeenCalledWith(false)
    expect(props.onAnalytics).toHaveBeenCalledOnce()

    props.onExpandedChange.mockClear()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(props.onExpandedChange).toHaveBeenCalledWith(false)

    props.onExpandedChange.mockClear()
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss club tools' }))
    expect(props.onExpandedChange).toHaveBeenCalledWith(false)
  })

  it('hides the join-request manager when access management is unavailable', () => {
    mockViewport(false)
    render(<ClubToolSidebar {...sidebarProps()} showJoinRequests={false} />)

    expect(screen.queryByRole('button', { name: 'Join requests' })).toBeNull()
  })
})
