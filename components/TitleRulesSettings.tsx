'use client'

import { useEffect, useMemo, useState } from 'react'
import { updateTitleRules } from '@/lib/data'
import {
  DEFAULT_TITLE_RULES,
  titleBandSizes,
  validateTitleRules,
  type TitleBandRule,
  type TitleRuleMode,
  type TitleRules,
} from '@/lib/title-rules'

function distributeEvenly(bands: TitleBandRule[]) {
  const share = Math.floor((100 / bands.length) * 100) / 100
  return bands.map((band, index) => ({
    ...band,
    value: index === bands.length - 1 ? Math.round((100 - share * (bands.length - 1)) * 100) / 100 : share,
    remainder: undefined,
  }))
}

export default function TitleRulesSettings({
  clubId,
  rules,
  isManager,
}: {
  clubId: string
  rules: TitleRules
  isManager: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const [draft, setDraft] = useState<TitleRules>(rules)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => setDraft(rules), [rules])

  const previewSizes = useMemo(() => titleBandSizes(20, draft), [draft])
  const modeLabel = rules.mode === 'proportion' ? 'proportional allocation' : 'exact top/bottom counts'

  const changeMode = (mode: TitleRuleMode) => {
    setDraft((current) => {
      if (mode === current.mode) return current
      if (mode === 'proportion') return { mode, bands: distributeEvenly(current.bands) }
      const middle = Math.floor(current.bands.length / 2)
      return {
        mode,
        bands: current.bands.map((band, index) => ({
          ...band,
          value: index === middle ? 0 : 1,
          remainder: index === middle || undefined,
        })),
      }
    })
    setMessage(null)
  }

  const updateBand = (id: string, patch: Partial<TitleBandRule>) => {
    setDraft((current) => ({
      ...current,
      bands: current.bands.map((band) => band.id === id ? { ...band, ...patch } : band),
    }))
    setMessage(null)
  }

  const moveBand = (index: number, direction: -1 | 1) => {
    setDraft((current) => {
      const target = index + direction
      if (target < 0 || target >= current.bands.length) return current
      const bands = [...current.bands]
      ;[bands[index], bands[target]] = [bands[target], bands[index]]
      return { ...current, bands }
    })
  }

  const removeBand = (id: string) => {
    setDraft((current) => {
      if (current.bands.length === 1) return current
      let bands = current.bands.filter((band) => band.id !== id)
      if (current.mode === 'count' && !bands.some((band) => band.remainder)) {
        const middle = Math.floor(bands.length / 2)
        bands = bands.map((band, index) => ({ ...band, remainder: index === middle || undefined }))
      }
      return { ...current, bands }
    })
    setMessage(null)
  }

  const addBand = () => {
    setDraft((current) => ({
      ...current,
      bands: [
        ...current.bands,
        {
          id: `title-${crypto.randomUUID()}`,
          title: 'New title',
          value: 0,
        },
      ],
    }))
    setMessage(null)
  }

  const save = async () => {
    setSaving(true)
    setMessage(null)
    try {
      const normalized = validateTitleRules(draft)
      await updateTitleRules(clubId, normalized)
      setDraft(normalized)
      setMessage('Club title rules saved.')
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save title rules.')
    } finally {
      setSaving(false)
    }
  }

  if (!expanded) return (
    <section className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] p-4 text-[rgb(var(--ink))]">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black">Club titles</p>
          <p className="mt-1 text-sm text-[rgb(var(--muted))]">{rules.bands.length} titles · {modeLabel}</p>
        </div>
        <button type="button" onClick={() => setExpanded(true)} className="min-h-11 rounded-lg bg-[rgb(var(--bamboo))] px-4 text-sm font-bold text-white">
          {isManager ? 'Edit club titles' : 'View club titles'}
        </button>
      </div>
    </section>
  )

  return (
    <section className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] p-4 text-[rgb(var(--ink))]">
      <div className="flex items-center justify-between gap-3">
        <div><p className="text-sm font-black">Club titles</p><p className="mt-1 text-xs text-[rgb(var(--muted))]">Ordered from highest rank to lowest rank.</p></div>
        <button type="button" onClick={() => setExpanded(false)} className="min-h-10 rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-3 text-sm font-bold">Collapse</button>
      </div>

      <fieldset className="mt-4" disabled={!isManager || saving}>
        <legend className="text-sm font-black">Allocation method</legend>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <label className={`rounded-lg border p-3 text-sm ${draft.mode === 'proportion' ? 'border-[rgb(var(--bamboo))] bg-[rgb(var(--bamboo)/.09)]' : 'border-[rgb(var(--line))]'}`}>
            <input type="radio" name="title-rule-mode" aria-label="Proportions" checked={draft.mode === 'proportion'} onChange={() => changeMode('proportion')} /> <strong>Proportions</strong>
            <span className="mt-1 block text-xs text-[rgb(var(--muted))]">Allocate a customizable percentage of the roster to every title.</span>
          </label>
          <label className={`rounded-lg border p-3 text-sm ${draft.mode === 'count' ? 'border-[rgb(var(--bamboo))] bg-[rgb(var(--bamboo)/.09)]' : 'border-[rgb(var(--line))]'}`}>
            <input type="radio" name="title-rule-mode" aria-label="Top/bottom counts" checked={draft.mode === 'count'} onChange={() => changeMode('count')} /> <strong>Top/bottom counts</strong>
            <span className="mt-1 block text-xs text-[rgb(var(--muted))]">Give exact counts to the top and bottom titles; one title fills the middle.</span>
          </label>
        </div>
      </fieldset>

      <div className="mt-4 grid gap-2">
        {draft.bands.map((band, index) => (
          <div key={band.id} className="rounded-lg border border-[rgb(var(--line))] bg-[rgb(var(--surface))] p-3">
            <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_120px_auto] sm:items-end">
              <label className="text-xs font-bold text-[rgb(var(--muted))]">Title name
                <input value={band.title} maxLength={40} disabled={!isManager || saving} onChange={(event) => updateBand(band.id, { title: event.target.value })} className="mt-1 min-h-10 w-full rounded border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] px-3 text-[rgb(var(--ink))] disabled:opacity-60" />
              </label>
              <label className="text-xs font-bold text-[rgb(var(--muted))]">{draft.mode === 'proportion' ? 'Roster %' : band.remainder ? 'Middle ranks' : 'Exact count'}
                <input type="number" min={0} max={draft.mode === 'proportion' ? 100 : 1000} step={draft.mode === 'proportion' ? 0.1 : 1} value={band.value} disabled={!isManager || saving || Boolean(band.remainder)} onChange={(event) => updateBand(band.id, { value: Number(event.target.value) })} className="mt-1 min-h-10 w-full rounded border border-[rgb(var(--line))] bg-[rgb(var(--surface-2))] px-3 text-[rgb(var(--ink))] disabled:opacity-60" />
              </label>
              <div className="flex gap-1">
                <button type="button" disabled={!isManager || saving || index === 0} onClick={() => moveBand(index, -1)} aria-label={`Move ${band.title} up`} className="h-10 w-10 rounded border border-[rgb(var(--line))] disabled:opacity-30">↑</button>
                <button type="button" disabled={!isManager || saving || index === draft.bands.length - 1} onClick={() => moveBand(index, 1)} aria-label={`Move ${band.title} down`} className="h-10 w-10 rounded border border-[rgb(var(--line))] disabled:opacity-30">↓</button>
                <button type="button" disabled={!isManager || saving || draft.bands.length === 1} onClick={() => removeBand(band.id)} aria-label={`Remove ${band.title}`} className="h-10 w-10 rounded border border-rose-300 text-rose-600 disabled:opacity-30">×</button>
              </div>
            </div>
            {draft.mode === 'count' ? <label className="mt-2 flex items-center gap-2 text-xs font-semibold text-[rgb(var(--muted))]"><input type="radio" name="remainder-title" aria-label={`Use ${band.title} for remaining middle ranks`} checked={Boolean(band.remainder)} disabled={!isManager || saving} onChange={() => setDraft((current) => ({ ...current, bands: current.bands.map((item) => ({ ...item, remainder: item.id === band.id || undefined })) }))} /> Use this title for all remaining middle ranks</label> : null}
            <p className="mt-2 text-xs text-[rgb(var(--muted))]">Preview with 20 players: {previewSizes[index]} player{previewSizes[index] === 1 ? '' : 's'}</p>
          </div>
        ))}
      </div>

      {draft.mode === 'proportion' ? <p className="mt-3 text-sm font-bold text-[rgb(var(--muted))]">Total: {Math.round(draft.bands.reduce((sum, band) => sum + band.value, 0) * 100) / 100}% (must equal 100%)</p> : null}
      {isManager ? <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={addBand} disabled={saving || draft.bands.length >= 25} className="min-h-10 rounded border border-[rgb(var(--line))] bg-[rgb(var(--surface))] px-3 text-sm font-bold disabled:opacity-50">Add title</button>
        <button type="button" onClick={() => { setDraft(DEFAULT_TITLE_RULES); setMessage(null) }} disabled={saving} className="min-h-10 rounded border border-[rgb(var(--line))] px-3 text-sm font-bold disabled:opacity-50">Restore defaults</button>
        <button type="button" onClick={() => void save()} disabled={saving} className="min-h-10 rounded bg-[rgb(var(--bamboo))] px-4 text-sm font-bold text-white disabled:opacity-50">{saving ? 'Saving titles...' : 'Save club titles'}</button>
      </div> : <p className="mt-4 text-sm font-semibold text-[rgb(var(--muted))]">Only a club manager can change title rules.</p>}
      {message ? <p role="status" className="mt-3 text-sm font-semibold">{message}</p> : null}
    </section>
  )
}
