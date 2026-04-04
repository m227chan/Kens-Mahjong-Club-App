import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import BottomNavigation from '@/components/BottomNavigation'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Ken\'s Mahjong Club Score Tracker',
  description: 'Track Hong Kong Mahjong scores for any group size',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-background text-text min-h-screen pb-16`}>
        {children}
        <BottomNavigation />
      </body>
    </html>
  )
}