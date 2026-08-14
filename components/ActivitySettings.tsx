'use client'

import { useEffect, useState } from 'react'
import { updateActivitySettings } from '@/lib/data'
import type { ActivitySettings as ActivitySettingsValue } from '@/lib/activity-settings'

export default function ActivitySettings({
  clubId,
  settings,
  isManager,
}: {
  clubId: string
  settings: ActivitySettingsValue
  isManager: boolean
}) {
  const [months, setMonths] = useState(settings.activePlayerMonths)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => setMonths(settings.activePlayerMonths), [settings.activePlayerMonths])

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      await updateActivitySettings(clubId, { activePlayerMonths: months })
      setMessage('Active player window saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save the active player window.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <section aria-labelledby="activity-settings-heading" className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] p-4 text-[rgb(var(--ink))]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h4 id="activity-settings-heading" className="text-sm font-black">Active players</h4>
          <p className="mt-1 max-w-md text-sm leading-5 text-[rgb(var(--muted))]">
            A player is active when they have played at least one club game within this many calendar months. Standings still default to all players.
          </p>
        </div>
        <div className="flex items-end gap-2">
          <label className="text-xs font-bold text-[rgb(var(--muted))]">
            Activity window
            <span className="mt-1 flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={36}
                step={1}
                value={months}
                disabled={!isManager || saving}
                onChange={(event) => setMonths(Number(event.target.value))}
                className="min-h-11 w-20 rounded border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-3 text-[rgb(var(--ink))] disabled:opacity-60"
              />
              <span>months</span>
            </span>
          </label>
          {isManager ? (
            <button
              type="button"
              onClick={() => void save()}
              disabled={saving || months === settings.activePlayerMonths || months < 1 || months > 36 || !Number.isInteger(months)}
              className="min-h-11 rounded bg-[rgb(var(--bamboo))] px-4 text-sm font-bold text-white disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          ) : null}
        </div>
      </div>
      {!isManager ? <p className="mt-3 text-xs font-semibold text-[rgb(var(--muted))]">Only a club manager can change this value.</p> : null}
      {message ? <p role="status" className="mt-3 text-sm font-semibold text-[rgb(var(--bamboo))]">{message}</p> : null}
    </section>
  )
}
