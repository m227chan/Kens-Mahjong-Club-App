import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Mahjong Messiah Score Tracker',
    short_name: 'Mahjong Messiah',
    description: 'A shared Mahjong club scorekeeper for live sessions, standings, and house rules.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    background_color: '#fffaf0',
    theme_color: '#c43d30',
    icons: [
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  }
}
