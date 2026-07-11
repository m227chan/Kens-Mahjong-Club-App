'use client'

import { useEffect, useState } from 'react'

export default function ThemeToggle() {
  const [enabled, setEnabled] = useState(false)

  useEffect(() => {
    const stored = window.localStorage.getItem('theme')
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const isDark = stored ? stored === 'dark' : prefersDark
    setEnabled(isDark)
    document.documentElement.classList.toggle('dark', isDark)
  }, [])

  const toggleTheme = () => {
    const next = !enabled
    setEnabled(next)
    document.documentElement.classList.toggle('dark', next)
    window.localStorage.setItem('theme', next ? 'dark' : 'light')
  }

  return (
    <button
      onClick={toggleTheme}
      aria-label={enabled ? 'Switch to light theme' : 'Switch to dark theme'}
      title={enabled ? 'Switch to light theme' : 'Switch to dark theme'}
      className="group flex h-11 w-11 items-center justify-center rounded-full border border-[rgb(var(--line))] bg-[rgb(var(--surface))] text-lg text-[rgb(var(--ink))] shadow-[3px_3px_0_rgb(var(--shadow)/0.08)] hover:border-[rgb(var(--cinnabar))]"
    >
      {enabled ? '☀' : '☾'}
    </button>
  )
}
