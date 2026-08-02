import type { Metadata, Viewport } from 'next'
import Link from 'next/link'
import './globals.css'
import { Manrope, JetBrains_Mono } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import UserSettings from '@/components/UserSettings'
import AppGuide from '@/components/AppGuide'
import WikiHeaderLink from '@/components/WikiHeaderLink'
import { SoundProvider } from '@/contexts/SoundContext'
import { GameSyncProvider } from '@/contexts/GameSyncContext'
import ViewportMetrics from '@/components/ViewportMetrics'
import { BrandLockup } from '@/components/BrandMark'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Mahjong Messiah Score Tracker',
  applicationName: 'Mahjong Messiah',
  description: 'A modern Mahjong club scorekeeper with experience-aware Skill ratings and analytics.',
  icons: { icon: '/icon.svg', shortcut: '/icon.svg', apple: '/icon.svg' },
  appleWebApp: { title: 'Mahjong Messiah', capable: true },
  manifest: '/manifest.webmanifest',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  colorScheme: 'light dark',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fffaf0' },
    { media: '(prefers-color-scheme: dark)', color: '#071c15' },
  ],
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${jetbrainsMono.variable}`}>
      <body className="club-atmosphere min-h-screen">
        <ViewportMetrics />
        <AuthProvider>
          <SoundProvider>
          <GameSyncProvider>
          <div className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-[50000] focus:rounded focus:bg-[rgb(var(--ink))] focus:px-4 focus:py-3 focus:text-sm focus:font-black focus:text-[rgb(var(--surface))]"
            >
              Skip to main content
            </a>
            <header className="club-header sticky top-0 z-40 px-5 py-4 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <Link
                  href="/"
                  aria-label="Mahjong Messiah — personal dashboard"
                  className="brand-home-link group flex min-h-11 min-w-0 cursor-pointer items-center rounded-sm focus-visible:outline-none"
                >
                  <BrandLockup className="brand-lockup-header" showDescriptor />
                </Link>
                <div className="flex items-center gap-2">
                  <WikiHeaderLink />
                  <AppGuide />
                  <UserSettings />
                </div>
              </div>
            </header>
            <main id="main-content" tabIndex={-1} className="min-w-0 flex-1">{children}</main>
          </div>
          </GameSyncProvider>
          </SoundProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
