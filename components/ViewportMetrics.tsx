'use client'

import { useEffect } from 'react'

/**
 * Keeps overlays sized to the part of a mobile screen that is actually visible.
 * iOS Safari's layout viewport can remain taller than the area above its browser
 * chrome or software keyboard, so viewport units alone are not always enough.
 */
export default function ViewportMetrics() {
  useEffect(() => {
    const root = document.documentElement
    const sync = () => {
      const viewport = window.visualViewport
      root.style.setProperty('--visual-viewport-height', `${Math.round(viewport?.height ?? window.innerHeight)}px`)
      root.style.setProperty('--visual-viewport-top', `${Math.round(viewport?.offsetTop ?? 0)}px`)
    }

    sync()
    window.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('resize', sync)
    window.visualViewport?.addEventListener('scroll', sync)
    return () => {
      window.removeEventListener('resize', sync)
      window.visualViewport?.removeEventListener('resize', sync)
      window.visualViewport?.removeEventListener('scroll', sync)
      root.style.removeProperty('--visual-viewport-height')
      root.style.removeProperty('--visual-viewport-top')
    }
  }, [])

  return null
}
