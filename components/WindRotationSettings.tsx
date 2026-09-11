'use client'

import { useEffect, useState } from 'react'
import { updateWindRotationSettings } from '@/lib/data'
import {
  WIND_ROTATION_MODE_OPTIONS,
  type WindRotationMode,
  type WindRotationSettings as WindRotationSettingsValue,
} from '@/lib/wind-rotation-settings'

export default function WindRotationSettings({
  clubId,
  settings,
  isManager,
  embedded = false,
}: {
  clubId: string
  settings: WindRotationSettingsValue
  isManager: boolean
  embedded?: boolean
}) {
  const [draft, setDraft] = useState<WindRotationSettingsValue>(settings)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ text: string; tone: 'success' | 'error' } | null>(null)

  useEffect(() => {
    setDraft(settings)
  }, [settings])

  const dirty = draft.mode !== settings.mode

  const save = async () => {
    if (!isManager || !dirty) return
    setSaving(true)
    setMessage(null)
    try {
      await updateWindRotationSettings(clubId, draft)
      setMessage({ text: 'Wind rotation rules saved.', tone: 'success' })
    } catch (error) {
      setMessage({
        text:
          error instanceof Error
            ? error.message
            : 'Unable to save wind rotation rules.',
        tone: 'error',
      })
    } finally {
      setSaving(false)
    }
  }

  const body = (
    <>
      <p className="text-sm leading-6 text-[rgb(var(--muted))]">
        Controls when seat winds and the dealer move after a hand in focused table wind view.
        After a full cycle back to the round starter, the table (prevailing) wind advances.
      </p>
      <div className="mt-4 grid gap-3" role="radiogroup" aria-label="Wind rotation mode">
        {WIND_ROTATION_MODE_OPTIONS.map((option) => (
          <label
            key={option.mode}
            className={`rounded-lg border p-3 text-sm ${
              draft.mode === option.mode
                ? 'border-[rgb(var(--bamboo))] bg-[rgb(var(--bamboo)/.09)]'
                : 'border-[rgb(var(--line))]'
            }`}
          >
            <input
              type="radio"
              name="wind-rotation-mode"
              aria-label={option.label}
              checked={draft.mode === option.mode}
              disabled={!isManager}
              onChange={() => {
                setDraft({ mode: option.mode as WindRotationMode })
                setMessage(null)
              }}
            />{' '}
            <strong>{option.label}</strong>
            <span className="mt-1 block text-[rgb(var(--muted))]">{option.description}</span>
          </label>
        ))}
      </div>
      {isManager ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!dirty || saving}
            onClick={() => void save()}
            className="min-h-11 rounded-lg bg-[rgb(var(--bamboo))] px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
          >
            {saving ? 'Saving…' : 'Save wind rotation'}
          </button>
          {dirty ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                setDraft(settings)
                setMessage(null)
              }}
              className="min-h-11 rounded-lg border border-[rgb(var(--line))] px-4 py-2 text-sm font-bold"
            >
              Reset
            </button>
          ) : null}
        </div>
      ) : (
        <p className="mt-4 text-sm font-semibold text-[rgb(var(--muted))]">
          Only a club manager can change wind rotation rules.
        </p>
      )}
      {message ? (
        <p
          role="status"
          className={`mt-3 text-sm font-bold ${
            message.tone === 'success' ? 'text-[rgb(var(--bamboo))]' : 'text-rose-700'
          }`}
        >
          {message.text}
        </p>
      ) : null}
    </>
  )

  if (embedded) {
    return (
      <section
        aria-labelledby="wind-rotation-heading"
        className="club-settings-card mt-4 rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] p-4 text-[rgb(var(--ink))] sm:p-5"
      >
        <h5 id="wind-rotation-heading" className="text-base font-black">
          Wind rotation
        </h5>
        <div className="mt-2">{body}</div>
      </section>
    )
  }

  return (
    <section
      aria-labelledby="wind-rotation-heading"
      className="club-settings-card rounded-xl border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] p-4 text-[rgb(var(--ink))] sm:p-5"
    >
      <h4 id="wind-rotation-heading" className="text-lg font-black">
        Wind rotation
      </h4>
      <div className="mt-2">{body}</div>
    </section>
  )
}
