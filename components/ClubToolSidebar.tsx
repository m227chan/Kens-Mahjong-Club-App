'use client'

import { useEffect, useRef, useState, type RefObject } from 'react'

type ClubToolSidebarProps = {
  expanded: boolean
  onExpandedChange: (value: boolean) => void
  mobileReturnFocusRef?: RefObject<HTMLButtonElement | null>
  rosterOpen: boolean
  analyticsOpen: boolean
  gameLogsOpen: boolean
  networkOpen: boolean
  requestsOpen?: boolean
  settingsOpen: boolean
  onRoster: () => void
  onAnalytics: () => void
  onGameLogs: () => void
  onNetwork: () => void
  onRequests?: () => void
  onSettings: () => void
  showJoinRequests?: boolean
  pendingRequestCount?: number
}

type ToolIconName = 'users' | 'chart' | 'list' | 'network' | 'requests' | 'settings'

function ToolIcon({ name }: { name: ToolIconName }) {
  const common = {
    'aria-hidden': true,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
  }

  if (name === 'users') return <svg {...common}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></svg>
  if (name === 'chart') return <svg {...common}><path d="M3 3v18h18" /><path d="m7 16 4-5 3 2 5-7" /></svg>
  if (name === 'list') return <svg {...common}><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></svg>
  if (name === 'network') return <svg {...common}><circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><path d="m10.7 6.7-4.4 10.6M13.3 6.7l4.4 10.6M7 19h10" /></svg>
  if (name === 'requests') return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20c.5-4 2.5-6 6-6 1.5 0 2.8.35 3.8 1.05M16 12l2 2 4-5" /></svg>
  return <svg {...common}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
}

function Chevron({ expanded }: { expanded: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d={expanded ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} /></svg>
}

function DrawerIcon({ expanded }: { expanded: boolean }) {
  return expanded
    ? <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round"><path d="m6 6 12 12M18 6 6 18" /></svg>
    : <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
}

export default function ClubToolSidebar({
  expanded,
  onExpandedChange,
  mobileReturnFocusRef,
  rosterOpen,
  analyticsOpen,
  gameLogsOpen,
  networkOpen,
  requestsOpen = false,
  settingsOpen,
  onRoster,
  onAnalytics,
  onGameLogs,
  onNetwork,
  onRequests = () => undefined,
  onSettings,
  showJoinRequests = false,
  pendingRequestCount = 0,
}: ClubToolSidebarProps) {
  const toggleRef = useRef<HTMLButtonElement>(null)
  const previouslyExpanded = useRef(expanded)
  const [mobileDrawer, setMobileDrawer] = useState(false)

  useEffect(() => {
    const media = window.matchMedia?.('(max-width: 767px)')
    if (!media) return
    const sync = () => setMobileDrawer(media.matches)
    sync()
    media.addEventListener?.('change', sync)
    return () => media.removeEventListener?.('change', sync)
  }, [])

  useEffect(() => {
    if (!expanded || !mobileDrawer) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExpandedChange(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [expanded, mobileDrawer, onExpandedChange])

  useEffect(() => {
    if (mobileDrawer && expanded) {
      const previousOverflow = document.body.style.overflow
      document.body.style.overflow = 'hidden'
      return () => { document.body.style.overflow = previousOverflow }
    }
  }, [expanded, mobileDrawer])

  useEffect(() => {
    if (previouslyExpanded.current && !expanded) {
      if (mobileDrawer) mobileReturnFocusRef?.current?.focus({ preventScroll: true })
      else toggleRef.current?.focus({ preventScroll: true })
    }
    previouslyExpanded.current = expanded
  }, [expanded, mobileDrawer, mobileReturnFocusRef])

  const toolGroups = [
    {
      label: 'Explore',
      tools: [
        { label: 'Roster', detail: 'Players and account links', icon: 'users' as const, tour: 'roster-open', open: rosterOpen, onClick: onRoster, dialog: 'club-roster-dialog' },
        { label: 'Analytics', detail: 'Scores, Skill, and records', icon: 'chart' as const, tour: 'analytics-open', open: analyticsOpen, onClick: onAnalytics, dialog: 'club-analytics-dialog' },
        { label: 'Game logs', detail: 'Review recorded games', icon: 'list' as const, tour: 'logs-open', open: gameLogsOpen, onClick: onGameLogs, dialog: 'game-logs-dialog' },
        { label: 'Player network', detail: 'See shared-table history', icon: 'network' as const, tour: 'network-open', open: networkOpen, onClick: onNetwork, dialog: 'network-graph-dialog' },
      ],
    },
    {
      label: 'Manage',
      tools: [
        ...(showJoinRequests ? [{ label: 'Join requests', detail: pendingRequestCount === 1 ? '1 pending request' : `${pendingRequestCount} pending requests`, icon: 'requests' as const, tour: 'requests-open', open: requestsOpen, onClick: onRequests, dialog: 'club-requests-dialog', badge: pendingRequestCount }] : []),
        { label: 'Club settings', detail: 'Seasons, rules, and access', icon: 'settings' as const, tour: 'settings-open', open: settingsOpen, onClick: onSettings, dialog: 'club-settings-dialog' },
      ],
    },
  ]

  const toggleLabel = mobileDrawer
    ? expanded ? 'Close club tools' : 'Open club tools'
    : expanded ? 'Collapse club tools' : 'Expand club tools'

  return (
    <aside className={`club-tool-sidebar${expanded ? ' is-expanded' : ''}`} aria-label="Club navigation">
      {expanded && mobileDrawer ? <button type="button" className="club-tool-sidebar-backdrop" aria-label="Dismiss club tools" onClick={() => onExpandedChange(false)} /> : null}
      <div id="club-tool-sidebar-panel" className="club-tool-sidebar-panel">
        <div className="club-tool-sidebar-heading">
          <div className="club-tool-sidebar-identity">
            <span className="club-tool-sidebar-title">Club navigation</span>
            <span className="club-tool-sidebar-subtitle">Explore and manage</span>
          </div>
          <button
            ref={toggleRef}
            type="button"
            data-tour="club-tools-toggle"
            className="club-tool-sidebar-toggle"
            aria-label={toggleLabel}
            aria-expanded={expanded}
            aria-controls="club-tool-sidebar-panel"
            onClick={() => onExpandedChange(!expanded)}
          >
            <span className="club-tool-sidebar-desktop-toggle"><Chevron expanded={expanded} /></span>
            <span className="club-tool-sidebar-mobile-toggle"><DrawerIcon expanded={expanded} /></span>
            <span className="club-tool-sidebar-mobile-label">{expanded ? 'Close' : 'Club tools'}</span>
          </button>
        </div>
        <nav className="club-tool-sidebar-nav" aria-label="Club destinations">
          {toolGroups.map((group) => (
            <div key={group.label} className="club-tool-sidebar-group">
              <p className="club-tool-sidebar-group-label">{group.label}</p>
              <div className="club-tool-sidebar-group-actions">
                {group.tools.map((tool) => (
                  <button
                    key={tool.label}
                    type="button"
                    data-tour={tool.tour}
                    aria-label={tool.label}
                    aria-haspopup="dialog"
                    aria-expanded={tool.open}
                    aria-controls={tool.dialog}
                    data-tooltip={tool.label}
                    className={`club-tool-sidebar-action${tool.open ? ' is-open' : ''}`}
                    onClick={() => {
                      if (mobileDrawer) onExpandedChange(false)
                      tool.onClick()
                    }}
                  >
                    <span className="club-tool-sidebar-icon"><ToolIcon name={tool.icon} /></span>
                    <span className="club-tool-sidebar-copy">
                      <span className="club-tool-label">{tool.label}{'badge' in tool && typeof tool.badge === 'number' && tool.badge > 0 ? <span className="club-tool-request-badge" aria-label={`${tool.badge} pending`}>{tool.badge > 99 ? '99+' : tool.badge}</span> : null}</span>
                      <span className="club-tool-detail">{tool.detail}</span>
                    </span>
                    <span className="club-tool-sidebar-active-mark" aria-hidden="true" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  )
}
