'use client'

import { BASE_TILE_IDS, BASE_TILE_INDEX, TILE_GLYPHS, TILE_LABELS, tileSuit, type BaseTileId } from '@/lib/mahjong-hk/tiles'

const GROUPS = [
  { id: 'characters', label: 'Characters' },
  { id: 'bamboo', label: 'Bamboo' },
  { id: 'dots', label: 'Dots' },
  { id: 'honor', label: 'Winds & dragons' },
] as const

export default function ManualHandEditor({ tiles, onChange, maximum = 14 }: {
  tiles: BaseTileId[]
  onChange: (tiles: BaseTileId[]) => void
  maximum?: number
}) {
  const counts = new Uint8Array(34)
  tiles.forEach((tile) => { counts[BASE_TILE_INDEX[tile]] += 1 })
  const add = (tile: BaseTileId) => {
    if (tiles.length >= maximum || counts[BASE_TILE_INDEX[tile]] >= 4) return
    onChange([...tiles, tile].sort((a, b) => BASE_TILE_INDEX[a] - BASE_TILE_INDEX[b]))
  }
  const removeAt = (index: number) => onChange(tiles.filter((_, tileIndex) => tileIndex !== index))

  return (
    <section className="rounded-2xl border border-emerald-200/20 bg-emerald-950/45 p-4 shadow-xl">
      <div className="flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-300">Current hand</p>
          <h2 className="mt-1 text-lg font-black text-stone-50">Tap a tile to remove it</h2>
        </div>
        <span className={`rounded-full px-3 py-1 text-sm font-black ${tiles.length === maximum ? 'bg-emerald-300 text-emerald-950' : 'bg-stone-900 text-stone-200'}`}>
          {tiles.length}/{maximum}
        </span>
      </div>

      <div className="mt-4 flex min-h-20 flex-wrap content-start gap-1.5 rounded-xl border border-dashed border-emerald-200/25 bg-black/15 p-2" aria-label="Entered hand">
        {tiles.length ? tiles.map((tile, index) => (
          <button
            type="button"
            key={`${tile}-${index}`}
            onClick={() => removeAt(index)}
            title={`Remove ${TILE_LABELS[tile]}`}
            className="flex h-16 w-11 flex-col items-center justify-center rounded-lg border border-stone-300 bg-stone-50 text-slate-950 shadow-sm active:translate-y-0.5"
          >
            <span className="text-3xl leading-none" aria-hidden="true">{TILE_GLYPHS[tile]}</span>
            <span className="sr-only">{TILE_LABELS[tile]}</span>
          </button>
        )) : <p className="m-auto text-center text-sm font-semibold text-emerald-100/60">Add the 14 tiles after your draw.</p>}
      </div>

      <div className="mt-4 grid gap-3">
        {GROUPS.map((group) => (
          <div key={group.id}>
            <p className="mb-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-emerald-100/60">{group.label}</p>
            <div className="grid grid-cols-9 gap-1">
              {BASE_TILE_IDS.filter((tile) => tileSuit(tile) === group.id).map((tile) => {
                const disabled = tiles.length >= maximum || counts[BASE_TILE_INDEX[tile]] >= 4
                return (
                  <button
                    type="button"
                    key={tile}
                    onClick={() => add(tile)}
                    disabled={disabled}
                    title={`Add ${TILE_LABELS[tile]}`}
                    className="aspect-[3/4] min-w-0 rounded-md border border-stone-300 bg-stone-50 text-[clamp(1.25rem,6vw,2rem)] leading-none text-slate-950 shadow-sm disabled:cursor-not-allowed disabled:opacity-25"
                  >
                    <span aria-hidden="true">{TILE_GLYPHS[tile]}</span>
                    <span className="sr-only">{TILE_LABELS[tile]}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      {tiles.length ? <button type="button" onClick={() => onChange([])} className="mt-4 rounded-lg border border-emerald-200/25 px-3 py-2 text-sm font-bold text-emerald-100">Clear hand</button> : null}
    </section>
  )
}

