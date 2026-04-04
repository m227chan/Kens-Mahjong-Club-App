'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const navigation = [
  { name: 'Leaderboard', href: '/', icon: '🀄' },
  { name: 'Dashboard', href: '/dashboard', icon: '📊' },
  { name: 'Scores', href: '/scores', icon: '➕' },
]

export default function BottomNavigation() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-card border-t border-gray-700">
      <div className="flex justify-around">
        {navigation.map((item) => {
          const isActive = pathname === item.href
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center py-3 px-4 min-h-[44px] flex-1 ${
                isActive
                  ? 'text-yellow-400 bg-yellow-400/10'
                  : 'text-gray-400 hover:text-text'
              }`}
            >
              <span className="text-lg mb-1">{item.icon}</span>
              <span className="text-xs font-medium">{item.name}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}