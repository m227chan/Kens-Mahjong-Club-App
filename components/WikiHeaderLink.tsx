'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

export default function WikiHeaderLink() {
  const { user, loading } = useAuth()
  const pathname = usePathname()

  if (loading || !user) {
    return null
  }

  if (pathname === '/login' || pathname === '/login/') {
    return null
  }

  return (
    <Link
      href="/wiki"
      aria-label="Open Mahjong hand wiki"
      title="Wiki"
      className="group flex h-11 w-11 items-center justify-center rounded-full border border-[rgb(var(--line))] bg-[rgb(var(--surface))] text-lg font-black text-[rgb(var(--ink))] shadow-[3px_3px_0_rgb(var(--shadow)/0.08)] hover:border-[rgb(var(--gold))]"
    >
      📖
    </Link>
  )
}
