'use client'

import { useEffect, useMemo, useState } from 'react'
import { updateScoringRules } from '@/lib/data'
import {
  fanLabel,
  fanValues,
  MAX_ALLOWED_FAN,
  MIN_ALLOWED_FAN,
  suggestedBasePoints,
  validateScoringRules,
  type ScoringRules,
} from '@/lib/scoring-rules'

export default function ScoringRulesSettings({
  clubId,
  rules,
  isManager,
}: {
  clubId: string
  rules: ScoringRules
  isManager: boolean
}) {
  const [draft, setDraft] = useState<ScoringRules>(rules)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => setDraft(rules), [rules])

  const values = useMemo(() => fanValues(draft), [draft])

  const changeRange = (field: 'minFan' | 'maxFan', value: number) => {
    if (!Number.isInteger(value)) return
    const minFan = field === 'minFan' ? value : draft.minFan
    const maxFan = field === 'maxFan' ? value : draft.maxFan
    if (
      minFan < MIN_ALLOWED_FAN ||
      maxFan > MAX_ALLOWED_FAN ||
      minFan > maxFan
    )
      return
    const fanPoints = { ...draft.fanPoints }
    for (let fan = minFan; fan <= maxFan; fan += 1)
      if (!fanPoints[fan]) fanPoints[fan] = suggestedBasePoints(fan)
    setDraft({ minFan, maxFan, fanPoints })
    setMessage(null)
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const normalized = validateScoringRules(draft)
      await updateScoringRules(clubId, normalized)
      setDraft(normalized)
      setMessage('House scoring rules saved for this club.')
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : 'Unable to save scoring rules.',
      )
    } finally {
      setSaving(false)
    }
  }

  if (!expanded) return (
    <section className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] p-4 text-[rgb(var(--ink))]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black">House scoring rules</p>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">Fan {rules.minFan}–{rules.maxFan}+ · club-specific point mapping</p>
        </div>
        <button type="button" onClick={() => setExpanded(true)} className="min-h-11 rounded-lg bg-[rgb(var(--bamboo))] px-4 text-sm font-bold text-white">
          {isManager ? 'Edit house scoring rules' : 'View house scoring rules'}
        </button>
      </div>
    </section>
  )

  return (
    <section className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] p-4 text-[rgb(var(--ink))]">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-black">House scoring rules</p>
        <button type="button" onClick={() => setExpanded(false)} className="min-h-10 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-3 text-sm font-bold">Collapse</button>
      </div>
      <p className="mt-2 text-sm leading-6 text-[rgb(var(--muted))]">
        These rules apply only to new games recorded in this club. The highest
        fan level is treated as a cap, so {draft.maxFan}+ uses the same base
        points. Existing game scores are not rewritten.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <label className="text-sm font-bold text-[rgb(var(--ink))]">
          Minimum fan
          <input
            type="number"
            min={MIN_ALLOWED_FAN}
            max={draft.maxFan}
            value={draft.minFan}
            disabled={!isManager || saving}
            onChange={(event) => changeRange('minFan', Number(event.target.value))}
            className="mt-2 min-h-11 w-full rounded border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-3 text-[rgb(var(--ink))] disabled:opacity-60"
          />
        </label>
        <label className="text-sm font-bold text-[rgb(var(--ink))]">
          Maximum fan (cap)
          <input
            type="number"
            min={draft.minFan}
            max={MAX_ALLOWED_FAN}
            value={draft.maxFan}
            disabled={!isManager || saving}
            onChange={(event) => changeRange('maxFan', Number(event.target.value))}
            className="mt-2 min-h-11 w-full rounded border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-3 text-[rgb(var(--ink))] disabled:opacity-60"
          />
        </label>
      </div>
      <div className="mt-4 overflow-hidden rounded border border-[rgb(var(--line))] bg-[rgb(var(--surface))]">
        <table className="w-full text-sm">
          <thead className="bg-[rgb(var(--surface-2))] text-left text-xs uppercase tracking-[.12em] text-[rgb(var(--ink))]">
            <tr><th className="px-3 py-2">Fan</th><th className="px-3 py-2">Base points</th></tr>
          </thead>
          <tbody>
            {values.map((fan) => (
              <tr key={fan} className="border-t border-[rgb(var(--line))]">
                <th scope="row" className="px-3 py-2 text-left font-black text-[rgb(var(--ink))]">{fanLabel(fan, draft)}</th>
                <td className="px-3 py-2">
                  <input
                    type="number"
                    min={1}
                    max={333333}
                    value={draft.fanPoints[fan] ?? ''}
                    disabled={!isManager || saving}
                    aria-label={`Base points for ${fanLabel(fan, draft)} fan`}
                    onChange={(event) => {
                      setDraft((current) => ({
                        ...current,
                        fanPoints: {
                          ...current.fanPoints,
                          [fan]: Number(event.target.value),
                        },
                      }))
                      setMessage(null)
                    }}
                    className="min-h-10 w-full rounded border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] px-3 font-mono font-bold text-[rgb(var(--ink))] disabled:opacity-60"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isManager ? (
        <button type="button" onClick={() => void save()} disabled={saving} className="mt-4 rounded bg-[rgb(var(--bamboo))] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">
          {saving ? 'Saving rules...' : 'Save house rules'}
        </button>
      ) : (
        <p className="mt-4 text-sm font-semibold text-[rgb(var(--muted))]">Only a club manager can change these rules.</p>
      )}
      {message ? <p role="status" className="mt-3 text-sm font-semibold text-[rgb(var(--ink))]">{message}</p> : null}
    </section>
  )
}
