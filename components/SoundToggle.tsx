'use client'

import { useSound } from '@/contexts/SoundContext'

export default function SoundToggle() {
  const { enabled, toggle } = useSound()
  return (
    <button type="button" onClick={toggle} aria-label={enabled ? 'Mute sounds' : 'Enable sounds'} title={enabled ? 'Mute sounds' : 'Enable sounds'} className="group flex h-11 w-11 items-center justify-center rounded-full border border-[rgb(var(--line))] bg-[rgb(var(--surface))] text-lg text-[rgb(var(--ink))] shadow-[3px_3px_0_rgb(var(--shadow)/0.08)] hover:border-[rgb(var(--bamboo))]">
      <span aria-hidden="true">{enabled ? '🔊' : '🔇'}</span>
    </button>
  )
}
