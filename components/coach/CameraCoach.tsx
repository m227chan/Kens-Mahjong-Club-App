'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import ManualHandEditor from '@/components/coach/ManualHandEditor'
import CameraPreview from '@/components/coach/CameraPreview'
import { useCoachRecommendation } from '@/components/coach/useCoachRecommendation'
import { deficiency, handFromTiles } from '@/lib/mahjong-hk/hand-solver'
import { HK_CLASSICAL_V1, type Wind } from '@/lib/mahjong-hk/rules/hk-classical-v1'
import { scoreWin } from '@/lib/mahjong-hk/scoring'
import type { ObservedGameState } from '@/lib/mahjong-hk/state'
import { BASE_TILE_INDEX, TILE_GLYPHS, TILE_LABELS, type BaseTileId } from '@/lib/mahjong-hk/tiles'

const FAIR_PLAY_KEY = 'mahjong-camera-coach-fair-play-v1'

function percent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function stateVersion(tiles: readonly BaseTileId[], seatWind: Wind): number {
  let hash = seatWind.charCodeAt(0)
  tiles.forEach((tile) => { hash = Math.imul(hash ^ (BASE_TILE_INDEX[tile] + 1), 16777619) })
  return hash >>> 0
}

export default function CameraCoach({ clubId, clubName }: { clubId: string; clubName: string }) {
  const [accepted, setAccepted] = useState<boolean | null>(null)
  const [tiles, setTiles] = useState<BaseTileId[]>([])
  const [seatWind, setSeatWind] = useState<Wind>('east')
  const [mode, setMode] = useState<'manual' | 'camera'>('manual')
  const { recommendation, calculating, error, evaluate, clear } = useCoachRecommendation()

  useEffect(() => {
    setAccepted(window.localStorage.getItem(FAIR_PLAY_KEY) === 'accepted')
  }, [])

  const observedState = useMemo<ObservedGameState>(() => ({
    hand: handFromTiles(tiles, {
      melds: [], bonusTiles: [], seatWind, roundWind: 'east', drawnTile: tiles.at(-1),
    }),
    discardsBySeat: [[], [], [], []],
    exposedMeldsBySeat: [[], [], [], []],
    bonusTilesBySeat: [[], [], [], []],
    activeSeat: 0,
    userSeat: 0,
    tilesRemainingEstimate: 60,
    lastEvent: tiles.length === 14 && tiles.at(-1) ? { type: 'USER_DRAW_CONFIRMED', tile: tiles.at(-1)! } : null,
    observationConfidence: 1,
    rulesVersion: HK_CLASSICAL_V1.id,
    version: stateVersion(tiles, seatWind),
  }), [seatWind, tiles])

  const distance = useMemo(() => tiles.length >= 13 ? deficiency(observedState.hand, HK_CLASSICAL_V1) : null, [observedState.hand, tiles.length])
  const winning = useMemo(() => tiles.length === 14
    ? scoreWin(observedState.hand, { winType: 'self_draw', winningTile: tiles.at(-1) }, HK_CLASSICAL_V1)
    : null, [observedState.hand, tiles])

  useEffect(() => {
    if (tiles.length !== 14 || (winning?.valid && winning.meetsMinimum)) {
      clear()
      return
    }
    const timer = window.setTimeout(() => evaluate(observedState, { rollouts: 128, ownDraws: 6, seed: observedState.version }), 180)
    return () => window.clearTimeout(timer)
  }, [clear, evaluate, observedState, tiles.length, winning?.meetsMinimum, winning?.valid])

  if (accepted === null) return <main className="min-h-screen bg-[#071d16]" />

  if (!accepted) {
    return (
      <main className="min-h-screen bg-[#071d16] px-4 py-8 text-stone-100">
        <section className="mx-auto max-w-lg rounded-2xl border border-emerald-200/20 bg-emerald-950/60 p-6 shadow-2xl">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">Practice assistant</p>
          <h1 className="mt-3 text-3xl font-black">Before using the coach</h1>
          <div className="mt-5 grid gap-3 text-sm leading-6 text-emerald-50/80">
            <p>Use live assistance only in practice or when every player at the table allows it.</p>
            <p>Camera processing stays on this device. The coach does not write to club sessions, rosters, or game logs.</p>
            <p>Recommendations are estimates, not guarantees. Always confirm the hand and house rules.</p>
          </div>
          <button
            type="button"
            onClick={() => { window.localStorage.setItem(FAIR_PLAY_KEY, 'accepted'); setAccepted(true) }}
            className="mt-6 w-full rounded-xl bg-emerald-300 px-4 py-3 font-black text-emerald-950"
          >
            I understand and everyone allows it
          </button>
          <Link href={`/club/${clubId}/`} className="mt-3 block rounded-xl border border-emerald-200/25 px-4 py-3 text-center font-bold text-emerald-100">Back to club</Link>
        </section>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top,#164b38_0,#071d16_48%,#03110d_100%)] pb-[max(2rem,env(safe-area-inset-bottom))] text-stone-100">
      <header className="sticky top-0 z-20 border-b border-emerald-200/15 bg-[#061a14]/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300">{clubName}</p>
            <h1 className="truncate text-lg font-black">Mahjong coach</h1>
          </div>
          <Link href={`/club/${clubId}/`} className="shrink-0 rounded-lg border border-emerald-200/25 px-3 py-2 text-sm font-bold">Close</Link>
        </div>
      </header>

      <div className="mx-auto grid max-w-5xl gap-4 px-3 py-4 md:grid-cols-[minmax(0,1fr)_20rem]">
        <div className="grid gap-4">
          <section className="rounded-2xl border border-amber-200/20 bg-amber-950/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-200">Input mode</p>
                <p className="mt-1 text-sm text-amber-50/75">Manual entry is authoritative. Camera calibration and recognition stay on this device.</p>
              </div>
              <label className="flex items-center gap-2 text-sm font-bold">
                Seat
                <select value={seatWind} onChange={(event) => setSeatWind(event.target.value as Wind)} className="rounded-lg border border-amber-200/25 bg-[#0d2a20] px-2 py-2 text-stone-100">
                  <option value="east">East</option><option value="south">South</option><option value="west">West</option><option value="north">North</option>
                </select>
              </label>
            </div>
            <div className="mt-3 grid grid-cols-2 rounded-xl bg-black/20 p-1">
              <button type="button" onClick={() => setMode('manual')} className={`rounded-lg px-3 py-2 text-sm font-black ${mode === 'manual' ? 'bg-amber-200 text-amber-950' : 'text-amber-50/70'}`}>Manual hand</button>
              <button type="button" onClick={() => setMode('camera')} className={`rounded-lg px-3 py-2 text-sm font-black ${mode === 'camera' ? 'bg-amber-200 text-amber-950' : 'text-amber-50/70'}`}>Camera</button>
            </div>
          </section>

          {mode === 'manual' ? <ManualHandEditor tiles={tiles} onChange={setTiles} /> : <CameraPreview clubId={clubId} />}
        </div>

        <aside className="grid content-start gap-4">
          <section className="rounded-2xl border border-emerald-200/20 bg-emerald-950/60 p-4 shadow-xl" aria-live="polite">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Recommendation</p>
            {tiles.length !== 14 ? (
              <div className="mt-4 rounded-xl border border-dashed border-emerald-200/20 p-5 text-center text-sm font-semibold text-emerald-100/65">
                Add {14 - tiles.length} more {14 - tiles.length === 1 ? 'tile' : 'tiles'} to analyze your move.
              </div>
            ) : winning?.valid && winning.meetsMinimum ? (
              <div className="mt-4 rounded-xl bg-amber-300 p-4 text-amber-950">
                <p className="text-3xl font-black">Declare a win</p>
                <p className="mt-2 font-bold">{winning.fan} fan · {winning.patterns.map((item) => item.label).join(', ')}</p>
              </div>
            ) : calculating ? (
              <div className="mt-4 animate-pulse rounded-xl bg-emerald-900/70 p-5 text-center font-bold">Simulating future draws…</div>
            ) : error ? (
              <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-950/40 p-4 text-sm font-bold text-rose-100">{error}</div>
            ) : recommendation ? (
              <div className="mt-4">
                <div className="rounded-xl bg-emerald-300 p-4 text-emerald-950">
                  <p className="text-xs font-black uppercase tracking-[0.16em]">Best estimated discard</p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="text-5xl leading-none" aria-hidden="true">{TILE_GLYPHS[recommendation.action.tile]}</span>
                    <div><p className="text-2xl font-black">Drop {TILE_LABELS[recommendation.action.tile]}</p><p className="text-sm font-bold">{recommendation.reasonCodes[1]?.replace('effective:', '').replace(':', ' types · ')} live copies</p></div>
                  </div>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-black/20 p-3"><dt className="text-[10px] font-black uppercase text-emerald-100/55">Estimated win</dt><dd className="mt-1 text-xl font-black">{percent(recommendation.winProbability.mean)}</dd><dd className="text-xs text-emerald-100/55">{percent(recommendation.winProbability.low95)}–{percent(recommendation.winProbability.high95)}</dd></div>
                  <div className="rounded-xl bg-black/20 p-3"><dt className="text-[10px] font-black uppercase text-emerald-100/55">Improve next draw</dt><dd className="mt-1 text-xl font-black">{percent(recommendation.improveNextDraw)}</dd></div>
                  <div className="rounded-xl bg-black/20 p-3"><dt className="text-[10px] font-black uppercase text-emerald-100/55">Distance</dt><dd className="mt-1 text-xl font-black">{recommendation.alternatives[0]?.deficiency ?? distance}</dd></div>
                  <div className="rounded-xl bg-black/20 p-3"><dt className="text-[10px] font-black uppercase text-emerald-100/55">Simulations</dt><dd className="mt-1 text-xl font-black">{recommendation.rolloutCount.toLocaleString()}</dd></div>
                </dl>
                <details className="mt-3 rounded-xl border border-emerald-200/15 p-3">
                  <summary className="cursor-pointer text-sm font-black">Compare discards</summary>
                  <ol className="mt-3 grid gap-2">
                    {recommendation.alternatives.slice(0, 5).map((item) => (
                      <li key={item.action.tile} className="flex items-center justify-between gap-2 rounded-lg bg-black/15 px-3 py-2 text-sm">
                        <span className="font-bold">{TILE_GLYPHS[item.action.tile]} {TILE_LABELS[item.action.tile]}</span>
                        <span className="text-emerald-100/65">{item.effectiveCopies} live · {percent(item.winProbability.mean)}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              </div>
            ) : null}
          </section>

          <section className="rounded-2xl border border-emerald-200/15 bg-black/15 p-4 text-sm text-emerald-50/70">
            <p className="font-black text-emerald-100">{HK_CLASSICAL_V1.displayName}</p>
            <p className="mt-2">Minimum {HK_CLASSICAL_V1.minimumFan} fan · capped at {HK_CLASSICAL_V1.fanCap}. Estimates currently model your draws and public-tile counts; opponent danger is not yet scored.</p>
          </section>
        </aside>
      </div>
    </main>
  )
}
