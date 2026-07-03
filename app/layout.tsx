import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/contexts/AuthContext'
import ThemeToggle from '@/components/ThemeToggle'

export const metadata: Metadata = {
  title: 'Ken\'s Mahjong Club Score Tracker',
  description: 'A modern Firebase-backed Mahjong club scorekeeper with ELO and analytics.'
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen bg-zinc-50 text-zinc-900 transition-colors duration-200 dark:bg-zinc-950 dark:text-zinc-100">
        <AuthProvider>
          <div className="mx-auto flex min-h-screen max-w-7xl flex-col">
            <header className="sticky top-0 z-20 border-b border-zinc-200/70 bg-white/80 px-4 py-3 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/70">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-500">Ken&apos;s Mahjong Club</p>
                  <h1 className="text-sm font-medium text-zinc-700 dark:text-zinc-200">Score tracker</h1>
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
