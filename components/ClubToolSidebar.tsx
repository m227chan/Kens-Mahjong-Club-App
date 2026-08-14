'use client'

import { useEffect, useRef } from 'react'

type ClubToolSidebarProps = {
  expanded: boolean
  onExpandedChange: (value: boolean) => void
  rosterOpen: boolean
  analyticsOpen: boolean
  gameLogsOpen: boolean
  networkOpen: boolean
  settingsOpen: boolean
  onRoster: () => void
  onAnalytics: () => void
  onGameLogs: () => void
  onNetwork: () => void
  onSettings: () => void
}

type ToolIconName = 'users' | 'activity' | 'chart' | 'list' | 'network' | 'settings'

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
  if (name === 'activity') return <svg {...common}><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>
  if (name === 'chart') return <svg {...common}><path d="M3 3v18h18" /><path d="m7 16 4-5 3 2 5-7" /></svg>
  if (name === 'list') return <svg {...common}><path d="M8 6h13M8 12h13M8 18h13" /><path d="M3 6h.01M3 12h.01M3 18h.01" /></svg>
  if (name === 'network') return <svg {...common}><circle cx="12" cy="5" r="2" /><circle cx="5" cy="19" r="2" /><circle cx="19" cy="19" r="2" /><path d="m10.7 6.7-4.4 10.6M13.3 6.7l4.4 10.6M7 19h10" /></svg>
  return <svg {...common}><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.38a2 2 0 0 0-.73-2.73l-.15-.09a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" /><circle cx="12" cy="12" r="3" /></svg>
}

function Chevron({ expanded }: { expanded: boolean }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d={expanded ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} /></svg>
}

export default function ClubToolSidebar({
  expanded,
  onExpandedChange,
  rosterOpen,
  analyticsOpen,
  gameLogsOpen,
  networkOpen,
  settingsOpen,
  onRoster,
  onAnalytics,
  onGameLogs,
  onNetwork,
  onSettings,
}: ClubToolSidebarProps) {
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (!expanded) return
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onExpandedChange(false)
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [expanded, onExpandedChange])

  useEffect(() => {
    if (!expanded) toggleRef.current?.focus()
  }, [expanded])

  const tools = [
    { label: 'Roster', icon: 'users' as const, tour: 'roster-open', open: rosterOpen, onClick: onRoster, dialog: 'club-roster-dialog' },
    { label: 'Analytics', icon: 'chart' as const, tour: 'analytics-open', open: analyticsOpen, onClick: onAnalytics, dialog: 'club-analytics-dialog' },
    { label: 'Game logs', icon: 'list' as const, tour: 'logs-open', open: gameLogsOpen, onClick: onGameLogs },
    { label: 'Network', icon: 'network' as const, tour: 'network-open', open: networkOpen, onClick: onNetwork },
    { label: 'Club settings', icon: 'settings' as const, tour: 'settings-open', open: settingsOpen, onClick: onSettings, dialog: 'club-settings-dialog' },
  ]

  return (
    <aside className={`club-tool-sidebar${expanded ? ' is-expanded' : ''}`} aria-label="Club tools">
      {expanded ? <button type="button" className="club-tool-sidebar-backdrop" aria-label="Close club tools" onClick={() => onExpandedChange(false)} /> : null}
      <div id="club-tool-sidebar-panel" className="club-tool-sidebar-panel">
        <div className="club-tool-sidebar-heading">
          <span className="club-tool-sidebar-title">Club tools</span>
          <button
            ref={toggleRef}
            type="button"
            data-tour="club-tools-toggle"
            className="club-tool-sidebar-toggle"
            aria-label={expanded ? 'Collapse club tools' : 'Expand club tools'}
            aria-expanded={expanded}
            aria-controls="club-tool-sidebar-panel"
            onClick={() => onExpandedChange(!expanded)}
          >
            <Chevron expanded={expanded} />
          </button>
        </div>
        <nav className="club-tool-sidebar-nav" aria-label="Club tools">
          {tools.map((tool, index) => (
            <div key={tool.label} className={index === tools.length - 1 ? 'club-tool-sidebar-divider' : undefined}>
              <button
                type="button"
                data-tour={tool.tour}
                aria-label={tool.label}
                aria-haspopup={tool.dialog ? 'dialog' : undefined}
                aria-expanded={tool.dialog ? tool.open : undefined}
                aria-controls={tool.dialog}
                title={tool.label}
                className={`club-tool-sidebar-action${tool.open ? ' is-open' : ''}`}
                onClick={() => {
                  onExpandedChange(false)
                  tool.onClick()
                }}
              >
                <span className="club-tool-sidebar-icon"><ToolIcon name={tool.icon} /></span>
                <span className="club-tool-label">{tool.label}</span>
              </button>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  )
}
