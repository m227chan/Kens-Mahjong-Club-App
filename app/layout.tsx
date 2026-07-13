import type { Metadata } from 'next'
import Link from 'next/link'
import './globals.css'
import { Manrope, JetBrains_Mono } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import ThemeToggle from '@/components/ThemeToggle'
import SoundToggle from '@/components/SoundToggle'
import { SoundProvider } from '@/contexts/SoundContext'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Ken\'s Mahjong Club Score Tracker',
  description: 'A modern Firebase-backed Mahjong club scorekeeper with ELO and analytics.',
  icons: { icon: '/icon.svg', shortcut: '/icon.svg', apple: '/icon.svg' }
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${jetbrainsMono.variable}`}>
      <body className="club-atmosphere min-h-screen">
        <AuthProvider>
          <SoundProvider>
          <div className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col">
            <header className="club-header sticky top-0 z-40 px-5 py-4 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <Link
                  href="/"
                  aria-label="Go to your personal dashboard"
                  className="group flex min-h-11 cursor-pointer flex-col justify-center rounded-sm focus-visible:outline-none"
                >
                  <p className="brand-kicker text-[10px] font-bold uppercase tracking-[0.42em] transition-opacity group-hover:opacity-75">Ken&apos;s Mahjong Club</p>
                  <p className="font-display text-lg font-black leading-none text-[rgb(var(--ink))] transition-colors group-hover:text-[rgb(var(--bamboo))]">Score tracker</p>
                </Link>
                <div className="flex items-center gap-2"><SoundToggle /><ThemeToggle /></div>
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </div>
          </SoundProvider>
        </AuthProvider>
      </body>
    </html>
  )
}
