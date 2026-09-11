'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  StaticMahjongTile,
  characterTileIds,
  bambooTileIds,
  circleTileIds,
  honorTileIds,
  type MahjongTileId,
} from '@/components/MahjongTile'
import { FLAT_HAND_MAX_TILE_COUNT } from '@/lib/hand-scoring/flat-hand-input'
import {
  buildWizardInput,
  classifyTilesForPaths,
  listMinFanPaths,
  meldsFitInTiles,
  subtractMeldsFromTiles,
  suggestSetCandidates,
  targetNumberedSuit,
  wizardProjectedFan,
  type MinFanPath,
  type PathWizardState,
} from '@/lib/hand-scoring/path-wizard'
import { getPatternExample } from '@/lib/hand-scoring/pattern-examples'
import { getPattern } from '@/lib/hand-scoring/patterns'
import type { ScoringRules } from '@/lib/scoring-rules'
import type { Meld } from '@/lib/hand-scoring/types'
import { totalFanDisplay } from '@/lib/hand-scoring/total-fan-display'
import { calculateFan } from '@/lib/hand-scoring/calculate-fan'
import PatternHandExample from './PatternHandExample'

const TILE_GROUPS = [
  { label: 'Characters', ids: characterTileIds },
  { label: 'Bamboo', ids: bambooTileIds },
  { label: 'Circles', ids: circleTileIds },
  { label: 'Honors', ids: honorTileIds },
]

const SUIT_LABELS = {
  character: 'Characters',
  bamboo: 'Bamboo',
  circle: 'Circles',
} as const

type PathsAnalyzeStepProps = {
  state: PathWizardState
  rules: ScoringRules
  onTilesChange: (tiles: MahjongTileId[]) => void
  onOpenMeldsChange: (melds: Meld[]) => void
}

function PathsPatternOption({
  path,
  selected,
  isMobile,
  onSelect,
}: {
  path: MinFanPath
  selected: boolean
  isMobile: boolean
  onSelect: () => void
}) {
  const [exampleOpen, setExampleOpen] = useState(false)
  const example = getPatternExample(path.id)
  const hasExample = Boolean(example)
  const fanLabel = path.alreadyMatched
    ? 'In hand'
    : path.fan === 'limit'
      ? 'Limit'
      : `+${path.fan} fan`
  const gapLabel = path.fanGap > 0 ? ` · need +${path.fanGap}` : ' · reaches min'

  return (
    <li
      className={`hand-scoring-suggestion-item paths-pattern-item${hasExample ? ' has-example' : ''}${selected ? ' is-focused' : ''}${path.alreadyMatched ? ' is-matched' : ''}`}
      tabIndex={hasExample && !isMobile ? 0 : undefined}
    >
      <div className="hand-scoring-suggestion-row">
        <button
          type="button"
          className="paths-pattern-select"
          aria-pressed={selected}
          onClick={onSelect}
        >
          <span className="hand-scoring-suggestion-copy">
            <span className="hand-scoring-suggestion-title">{path.title}</span>
            <span className="hand-scoring-hint">{path.description}</span>
          </span>
        </button>
        <div className="hand-scoring-suggestion-actions">
          <strong className="hand-scoring-suggestion-meta">
            {selected ? 'Selected · ' : ''}
            {fanLabel}
            {gapLabel}
          </strong>
          {isMobile && hasExample ? (
            <button
              type="button"
              className="hand-scoring-example-toggle"
              aria-expanded={exampleOpen}
              aria-controls={`paths-pattern-example-${path.id}`}
              onClick={() => setExampleOpen((current) => !current)}
            >
              {exampleOpen ? 'Hide example' : 'Example'}
            </button>
          ) : null}
        </div>
      </div>

      {isMobile && exampleOpen && example ? (
        <div id={`paths-pattern-example-${path.id}`} className="hand-scoring-suggestion-example-panel">
          <PatternHandExample hand={example} compact />
        </div>
      ) : null}

      {!isMobile && example ? (
        <div className="hand-scoring-suggestion-popover" role="tooltip">
          <p className="hand-scoring-popover-kicker">Example hand</p>
          <PatternHandExample hand={example} compact />
        </div>
      ) : null}
    </li>
  )
}

export default function PathsAnalyzeStep({
  state,
  rules,
  onTilesChange,
  onOpenMeldsChange,
}: PathsAnalyzeStepProps) {
  const [targetPatternId, setTargetPatternId] = useState<string | null>(null)
  const [patternListOpen, setPatternListOpen] = useState(true)
  const [invalidPatternNotice, setInvalidPatternNotice] = useState<string | null>(null)
  const [showTileEditor, setShowTileEditor] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)')
    const sync = () => setIsMobile(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])

  const paths = useMemo(() => listMinFanPaths(state, rules), [state, rules])

  useEffect(() => {
    if (!targetPatternId) return
    if (paths.some((path) => path.id === targetPatternId)) return

    const title = getPattern(targetPatternId)?.title ?? 'That pattern'
    setInvalidPatternNotice(`${title} is now invalid — please select another possible hand type.`)
    setTargetPatternId(null)
    setPatternListOpen(true)
  }, [paths, targetPatternId])

  const looseTiles = useMemo(() => subtractMeldsFromTiles(state.tiles, state.openMelds), [state.tiles, state.openMelds])
  const focusIds = targetPatternId ? [targetPatternId] : []
  const classified = useMemo(
    () => classifyTilesForPaths(looseTiles, paths, focusIds, state.tiles, state.openMelds),
    [looseTiles, paths, focusIds, state.tiles, state.openMelds],
  )
  const projection = useMemo(() => wizardProjectedFan(state, rules), [state, rules])
  const display = useMemo(() => {
    const result = calculateFan(buildWizardInput(state), rules)
    return totalFanDisplay(result, rules)
  }, [state, rules])

  const targetPath = paths.find((path) => path.id === targetPatternId) ?? null
  const committedSuit = useMemo(
    () => targetNumberedSuit(state.tiles, state.openMelds),
    [state.tiles, state.openMelds],
  )

  const candidates = useMemo(() => {
    return suggestSetCandidates(looseTiles).filter((candidate) =>
      meldsFitInTiles(looseTiles, [{ tiles: candidate.tiles, concealed: false }]),
    )
  }, [looseTiles])

  const selectTarget = (id: string) => {
    if (targetPatternId === id) {
      setTargetPatternId(null)
      setPatternListOpen(true)
      return
    }
    setInvalidPatternNotice(null)
    setTargetPatternId(id)
    setPatternListOpen(false)
  }

  const counts = useMemo(() => {
    const map = new Map<MahjongTileId, number>()
    for (const tile of state.tiles) map.set(tile, (map.get(tile) ?? 0) + 1)
    return map
  }, [state.tiles])

  const toggleTile = (id: MahjongTileId) => {
    const current = counts.get(id) ?? 0
    if (current >= 4) {
      onTilesChange(state.tiles.filter((tile) => tile !== id))
      return
    }
    if (state.tiles.length >= FLAT_HAND_MAX_TILE_COUNT) return
    onTilesChange([...state.tiles, id])
  }

  const removeLooseAt = (index: number) => {
    const tile = looseTiles[index]
    if (!tile) return
    let removed = false
    onTilesChange(
      state.tiles.filter((id) => {
        if (!removed && id === tile) {
          removed = true
          return false
        }
        return true
      }),
    )
  }

  const lockCandidate = (candidateTiles: MahjongTileId[]) => {
    if (!meldsFitInTiles(looseTiles, [{ tiles: candidateTiles, concealed: false }])) return
    onOpenMeldsChange([...state.openMelds, { tiles: [...candidateTiles], concealed: false }])
  }

  const unlockMeld = (index: number) => {
    onOpenMeldsChange(state.openMelds.filter((_, i) => i !== index))
  }

  const clearDropCount = classified.filter((tile) => tile.classification === 'clear-drop').length
  const usefulCount = classified.filter((tile) => tile.classification === 'useful').length

  const targetHint = (() => {
    if (!targetPath) return 'Choose a pattern below to highlight what to keep vs clear-drop.'
    if (targetPath.id === 'mixed-flush' && committedSuit) {
      return `Going for Mixed Flush with ${SUIT_LABELS[committedSuit]} locked — keep that suit and honors; other suits are clear drops.`
    }
    if (targetPath.id === 'pure-flush' && committedSuit) {
      return `Going for Pure Flush with ${SUIT_LABELS[committedSuit]} locked — keep only that suit; honors and other suits are clear drops.`
    }
    return `Going for ${targetPath.title} — green tiles help; faded tiles are clear drops.`
  })()

  return (
    <div className="hand-scoring-field paths-analyze">
      <div className="hand-scoring-paths-status">
        <p className="hand-scoring-kicker">Aim for {rules.minFan}+ fan</p>
        <p className="hand-scoring-hint">
          {state.openMelds.length} open lock{state.openMelds.length === 1 ? '' : 's'} · {state.tiles.length} tiles ·{' '}
          {paths.length} option{paths.length === 1 ? '' : 's'}
        </p>
        <p className="hand-scoring-paths-current-fan">
          From open melds + flowers: {display.main}
          {display.limitLabel ? <span className="hand-scoring-limit-label">{display.limitLabel}</span> : null}
          {projection.gap > 0 ? ` · need +${projection.gap} more` : ' · minimum reachable on structure'}
        </p>
      </div>

      <section className="hand-scoring-suggestion-section hand-scoring-paths-pattern-list">
        <button
          type="button"
          className="hand-scoring-suggestion-section-toggle"
          aria-expanded={patternListOpen}
          aria-controls="paths-pattern-list-panel"
          onClick={() => setPatternListOpen((open) => !open)}
        >
          <span className="hand-scoring-suggestion-section-title">
            {targetPath ? `Chasing ${targetPath.title}` : 'Choose a pattern to chase'}
          </span>
          <span className="hand-scoring-suggestion-section-meta">
            <span className="hand-scoring-suggestion-count">{paths.length}</span>
            <span className="hand-scoring-suggestion-chevron" aria-hidden="true">
              {patternListOpen ? '▾' : '▸'}
            </span>
          </span>
        </button>
        {invalidPatternNotice ? (
          <p className="hand-scoring-paths-invalid" role="status">
            {invalidPatternNotice}
          </p>
        ) : null}
        {patternListOpen ? (
          <div id="paths-pattern-list-panel" className="hand-scoring-suggestion-section-panel">
            <p className="hand-scoring-hint">
              {state.openMelds.length === 0 && !targetPath
                ? 'Nothing locked yet — most patterns stay open. Pick one to see clear drops in your bag.'
                : targetHint}
              {' '}
              {!isMobile ? 'Hover a pattern to preview a sample hand.' : 'Tap Example to preview a sample hand.'}
            </p>
            {paths.length > 0 ? (
              <ul className="hand-scoring-suggestion-list">
                {paths.map((path) => (
                  <PathsPatternOption
                    key={path.id}
                    path={path}
                    selected={targetPatternId === path.id}
                    isMobile={isMobile}
                    onSelect={() => selectTarget(path.id)}
                  />
                ))}
              </ul>
            ) : (
              <p className="hand-scoring-hint">No structural patterns left that can reach the minimum with this setup.</p>
            )}
            <p className="hand-scoring-hint">
              Timing bonuses like Blessings can be applied later in Calculate score.
            </p>
          </div>
        ) : null}
      </section>

      <div className="hand-scoring-flat-hand">
        <div className="hand-scoring-flat-hand-header">
          <span className="hand-scoring-subheading">
            {targetPath ? `Loose tiles for ${targetPath.title}` : 'Loose tiles'}
          </span>
          <button type="button" className="hand-scoring-secondary-btn" onClick={() => setShowTileEditor((v) => !v)}>
            {showTileEditor ? 'Hide editor' : 'Add / remove tiles'}
          </button>
        </div>
        {targetPath ? (
          <p className="hand-scoring-hint">
            {usefulCount} useful · {clearDropCount} clear drop{clearDropCount === 1 ? '' : 's'}
          </p>
        ) : null}
        <div className="hand-scoring-flat-hand-tiles">
          {classified.length > 0 ? (
            classified.map((tile) => (
              <button
                key={`${tile.id}-${tile.index}`}
                type="button"
                className={`hand-scoring-flat-hand-tile-btn is-${tile.classification}`}
                title={
                  tile.classification === 'clear-drop'
                    ? `Clear drop for ${targetPath?.title ?? 'this path'}`
                    : tile.classification === 'useful'
                      ? `Useful for ${targetPath?.title ?? 'this path'}`
                      : 'Select a pattern to classify this tile'
                }
                onClick={() => removeLooseAt(tile.index)}
              >
                <StaticMahjongTile id={tile.id} size={40} />
              </button>
            ))
          ) : (
            <p className="hand-scoring-hint">No loose tiles — unlock a meld or add tiles.</p>
          )}
        </div>
        <p className="hand-scoring-hint paths-legend">
          <span className="paths-legend-useful">Useful</span>
          <span className="paths-legend-drop">Clear drop</span>
          Tap a loose tile to remove it.
        </p>
      </div>

      {showTileEditor ? (
        <div className="hand-scoring-paths-tile-editor">
          {TILE_GROUPS.map((group) => (
            <div key={group.label} className="hand-scoring-tile-group">
              <span className="hand-scoring-tile-group-label">{group.label}</span>
              <div className="hand-scoring-tile-grid">
                {group.ids.map((id) => {
                  const count = counts.get(id) ?? 0
                  return (
                    <button
                      key={id}
                      type="button"
                      className={`hand-scoring-tile-btn${count > 0 ? ' is-selected' : ''}`}
                      onClick={() => toggleTile(id)}
                    >
                      <StaticMahjongTile id={id} size={36} />
                      {count > 0 ? <span className="hand-scoring-tile-count">{count}</span> : null}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {state.openMelds.length > 0 || candidates.length > 0 ? (
        <div className="hand-scoring-meld-list">
          <span className="hand-scoring-subheading">Open locks</span>
          {state.openMelds.map((meld, index) => (
            <div key={index} className="hand-scoring-meld-item">
              <div className="hand-scoring-meld-tiles">
                {meld.tiles.map((id, tileIndex) => (
                  <StaticMahjongTile key={`${id}-${tileIndex}`} id={id} size={36} />
                ))}
              </div>
              <button type="button" className="hand-scoring-remove-btn" aria-label={`Unlock meld ${index + 1}`} onClick={() => unlockMeld(index)}>
                ×
              </button>
            </div>
          ))}
          {candidates.slice(0, 4).map((candidate) => (
            <div key={candidate.key} className="hand-scoring-meld-item">
              <div className="hand-scoring-meld-tiles">
                {candidate.tiles.map((id, index) => (
                  <StaticMahjongTile key={`${id}-${index}`} id={id} size={36} />
                ))}
              </div>
              <button type="button" className="hand-scoring-open-btn" onClick={() => lockCandidate(candidate.tiles)}>
                Lock open
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
