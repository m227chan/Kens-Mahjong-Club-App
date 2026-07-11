import type { Metadata } from 'next'
import './globals.css'
import { Manrope, JetBrains_Mono } from 'next/font/google'
import { AuthProvider } from '@/contexts/AuthContext'
import ThemeToggle from '@/components/ThemeToggle'

const manrope = Manrope({ subsets: ['latin'], variable: '--font-sans' })
const jetbrainsMono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' })

export const metadata: Metadata = {
  title: 'Ken\'s Mahjong Club Score Tracker',
  description: 'A modern Firebase-backed Mahjong club scorekeeper with ELO and analytics.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${manrope.variable} ${jetbrainsMono.variable}`}>
      <body className="club-atmosphere min-h-screen">
        <AuthProvider>
          <div className="relative mx-auto flex min-h-screen max-w-[1500px] flex-col">
            <header className="club-header sticky top-0 z-40 px-5 py-4 backdrop-blur-xl">
              <div className="flex items-center justify-between">
                <div>
                  <p className="brand-kicker text-[10px] font-bold uppercase tracking-[0.42em]">Ken&apos;s Mahjong Club</p>
                  <h1 className="font-display text-lg font-black leading-none">Score tracker</h1>
                </div>
                <ThemeToggle />
              </div>
            </header>
            <main className="flex-1">{children}</main>
          </div>
        </AuthProvider>
      </body>
    </html>
  )
}
