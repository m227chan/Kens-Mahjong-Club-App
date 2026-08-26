import type { ReactNode } from 'react'

export type MenuGlyphName =
  | 'competition'
  | 'scoring'
  | 'activity'
  | 'titles'
  | 'access'
  | 'home'
  | 'sound'
  | 'appearance'
  | 'account'
  | 'sign-out'
  | 'delete'
  | 'edit'
  | 'add-player'
  | 'qr'
  | 'auto-join'
  | 'clear-tables'
  | 'shuffle'
  | 'reset'

export default function MenuGlyph({ name }: { name: MenuGlyphName }) {
  const paths: Record<MenuGlyphName, ReactNode> = {
    competition: <><path d="M5 4h14v4H5zM7 8v11m10-11v11M4 19h16" /><path d="m9 13 3-3 3 3-3 3z" /></>,
    scoring: <><path d="M4 19V9m6 10V5m6 14v-7m4 7H2" /></>,
    activity: <><circle cx="12" cy="8" r="3" /><path d="M5 20c.7-4 3-6 7-6s6.3 2 7 6" /></>,
    titles: <><path d="M7 4h10v5a5 5 0 0 1-10 0zM9 20h6m-3-6v6" /><path d="M7 6H4v2a3 3 0 0 0 3 3m10-5h3v2a3 3 0 0 1-3 3" /></>,
    access: <><rect x="4" y="10" width="16" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
    home: <><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10M9 20v-6h6v6" /></>,
    sound: <><path d="M5 10H2v4h3l4 4V6z" /><path d="M13 9a4 4 0 0 1 0 6m3-9a8 8 0 0 1 0 12" /></>,
    appearance: <><path d="M12 3a9 9 0 1 0 9 9c-5 2-10-3-9-9Z" /></>,
    account: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    'sign-out': <><path d="M10 4H4v16h6m5-4 4-4-4-4m4 4H8" /></>,
    delete: <><path d="M4 7h16M9 7V4h6v3m3 0-1 14H7L6 7m4 4v6m4-6v6" /></>,
    edit: <><path d="m4 20 4-1 11-11-3-3L5 16zM14 7l3 3" /></>,
    'add-player': <><circle cx="9" cy="8" r="3" /><path d="M3 20c.5-4 2.5-6 6-6 2 0 3.5.6 4.5 1.8M18 10v6m-3-3h6" /></>,
    qr: <><path d="M3 3h7v7H3zm11 0h7v7h-7zM3 14h7v7H3zM14 14h3v3h-3zm4 4h3v3h-3zm0-4h3m-7 7h3" /></>,
    'auto-join': <><path d="M4 12h7m-3-3 3 3-3 3" /><path d="M13 5h7v14h-7" /></>,
    'clear-tables': <><path d="M4 6h16M6 10h12M8 14h8M10 18h4" /></>,
    shuffle: <><path d="M16 3h5v5M3 16l18-13M8 21H3v-5M21 8l-5 5" /></>,
    reset: <><path d="M4 11a8 8 0 1 0 2-5.3L3 9" /><path d="M3 4v5h5" /></>,
  }

  return (
    <span className="app-menu-icon" aria-hidden="true">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
        {paths[name]}
      </svg>
    </span>
  )
}
