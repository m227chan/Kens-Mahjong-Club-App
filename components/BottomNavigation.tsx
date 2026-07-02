'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
  { name: 'Leaderboard', href: '/', icon: '🏆' },
  { name: 'Add Game', href: '/add-game', icon: '+' },
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Analytics', href: '/analytics', icon: '📈' },
  { name: 'Tables', href: '/tables', icon: '🪑' }
]

export default function BottomNavigation() {
  const pathname = usePathname()

  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200/70 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80 lg:static lg:border-t-0 lg:bg-transparent lg:backdrop-blur-none">
      <div className="mx-auto flex max-w-7xl justify-around px-2 py-2 lg:flex-col lg:gap-2 lg:px-4 lg:py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-medium transition ${
                isActive ? 'bg-blue-500 text-white shadow-sm' : 'text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100'
              }`}
            >
              <span>{item.icon}</span>
              <span>{item.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}