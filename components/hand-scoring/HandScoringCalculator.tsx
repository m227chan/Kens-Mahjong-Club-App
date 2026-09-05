'use client'

import { useEffect, useMemo, useState } from 'react'
import { calculateFan } from '@/lib/hand-scoring/calculate-fan'
import { flatTilesToMeldsAndPair } from '@/lib/hand-scoring/flat-hand-input'
import { suggestPatterns } from '@/lib/hand-scoring/suggest-patterns'
import { totalFanDisplay } from '@/lib/hand-scoring/total-fan-display'
import type { HandScoringInput, Wind } from '@/lib/hand-scoring/types'
import { subscribeScoringRules, subscribeUserClubs } from '@/lib/data'
import { DEFAULT_SCORING_RULES, type ScoringRules } from '@/lib/scoring-rules'
import type { ClubMembershipDoc } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import type { MahjongTileId } from '@/components/MahjongTile'
import BonusScenarioPicker from './BonusScenarioPicker'
import FlowerPicker from './FlowerPicker'
import MeldBuilder, { type HandEntryLayout } from './MeldBuilder'
import PatternSuggestions from './PatternSuggestions'
import ScoringBreakdown from './ScoringBreakdown'
import WindSelector from './WindSelector'

type CalculatorMode = 'calculate' | 'paths'

export type HandScoringCalculatorProps = {
  clubId?: string | null
  scoringRules?: ScoringRules
  onApplyFan?: (fan: number) => void
  embedded?: boolean
}

export default function HandScoringCalculator({
  clubId: initialClubId = null,
  scoringRules: initialRules,
  onApplyFan,
  embedded = false,
}: HandScoringCalculatorProps) {
  const { user } = useAuth()
  const [mode, setMode] = useState<CalculatorMode>('calculate')
  const [clubOptions, setClubOptions] = useState<ClubMembershipDoc[]>([])
  const [selectedClubId, setSelectedClubId] = useState<string | null>(initialClubId)
  const [scoringRules, setScoringRules] = useState<ScoringRules>(initialRules ?? DEFAULT_SCORING_RULES)
  const [seatWind, setSeatWind] = useState<Wind>('east')
  const [roundWind, setRoundWind] = useState<Wind>('east')
  const [flowers, setFlowers] = useState<MahjongTileId[]>([])
  const [melds, setMelds] = useState<HandScoringInput['melds']>([])
  const [pair, setPair] = useState<MahjongTileId[]>([])
  const [entryLayout, setEntryLayout] = useState<HandEntryLayout>('standard')
  const [flatTiles, setFlatTiles] = useState<MahjongTileId[]>([])
  const [bonuses, setBonuses] = useState<Set<string>>(new Set())
  const [includeNonTraditional, setIncludeNonTraditional] = useState(true)

  useEffect(() => {
    if (initialClubId) setSelectedClubId(initialClubId)
  }, [initialClubId])

  useEffect(() => {
    if (initialRules) setScoringRules(initialRules)
  }, [initialRules])

  useEffect(() => {
    if (initialClubId || !user?.uid) return undefined
    return subscribeUserClubs(user.uid, setClubOptions)
  }, [initialClubId, user?.uid])

  useEffect(() => {
    if (!selectedClubId || initialRules) return undefined
    return subscribeScoringRules(selectedClubId, setScoringRules)
  }, [selectedClubId, initialRules])

  const effectiveHand = useMemo(() => {
    if (entryLayout === 'special-flat') return flatTilesToMeldsAndPair(flatTiles)
    return { melds, pair: pair.length ? pair : undefined }
  }, [entryLayout, flatTiles, melds, pair])

  const input = useMemo<HandScoringInput>(
    () => ({
      seatWind,
      roundWind,
      flowers,
      melds: effectiveHand.melds,
      pair: effectiveHand.pair,
      bonuses,
      includeNonTraditional,
    }),
    [seatWind, roundWind, flowers, effectiveHand, bonuses, includeNonTraditional],
  )

  const result = useMemo(() => calculateFan(input, scoringRules), [input, scoringRules])
  const resultDisplay = useMemo(() => totalFanDisplay(result, scoringRules), [result, scoringRules])
  const suggestions = useMemo(
    () => (mode === 'paths' ? suggestPatterns(input, scoringRules) : []),
    [mode, input, scoringRules],
  )

  const toggleBonus = (id: string) => {
    setBonuses((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handleEntryLayoutChange = (layout: HandEntryLayout) => {
    setEntryLayout(layout)
    if (layout === 'special-flat') {
      setMelds([])
      setPair([])
    } else {
      setFlatTiles([])
    }
  }

  return (
    <div className={`hand-scoring-calculator${embedded ? ' is-embedded' : ''}`}>
      <header className="hand-scoring-header">
        <div>
          <p className="hand-scoring-kicker">Score Calculator</p>
          <h2 id="score-calculator-title" className="hand-scoring-title">Calculate fan and find winning paths</h2>
        </div>
        {!initialClubId ? (
          <label className="hand-scoring-club-select">
            <span className="hand-scoring-label">Club</span>
            <select
              value={selectedClubId ?? ''}
              onChange={(event) => setSelectedClubId(event.target.value || null)}
            >
              <option value="">Handbook defaults</option>
              {clubOptions.map((club) => (
                <option key={club.clubId} value={club.clubId}>{club.clubName}</option>
              ))}
            </select>
          </label>
        ) : null}
      </header>

      <div className="hand-scoring-mode-tabs" role="tablist" aria-label="Calculator mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'calculate'}
          className={`hand-scoring-tab${mode === 'calculate' ? ' is-active' : ''}`}
          onClick={() => setMode('calculate')}
        >
          Calculate score
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'paths'}
          className={`hand-scoring-tab${mode === 'paths' ? ' is-active' : ''}`}
          onClick={() => setMode('paths')}
        >
          Find winning paths
        </button>
      </div>

      <label className="hand-scoring-inline-check hand-scoring-traditional-toggle">
        <input
          type="checkbox"
          checked={includeNonTraditional}
          onChange={(event) => setIncludeNonTraditional(event.target.checked)}
        />
        Include non-traditional hands
      </label>

      <div className="hand-scoring-layout">
        <div className="hand-scoring-inputs">
          <WindSelector
            seatWind={seatWind}
            roundWind={roundWind}
            onSeatWindChange={setSeatWind}
            onRoundWindChange={setRoundWind}
          />
          <FlowerPicker seatWind={seatWind} selected={flowers} onChange={setFlowers} />
          <MeldBuilder
            layout={entryLayout}
            onLayoutChange={handleEntryLayoutChange}
            melds={melds}
            pair={pair}
            flatTiles={flatTiles}
            onMeldsChange={setMelds}
            onPairChange={setPair}
            onFlatTilesChange={setFlatTiles}
          />
          <BonusScenarioPicker selected={bonuses} onChange={setBonuses} />
        </div>

        <div className="hand-scoring-results">
          <ScoringBreakdown
            result={result}
            rules={scoringRules}
            melds={effectiveHand.melds}
            pair={effectiveHand.pair ?? []}
            flatTiles={entryLayout === 'special-flat' ? flatTiles : undefined}
          />
          {mode === 'paths' ? (
            <PatternSuggestions
              suggestions={suggestions}
              rules={scoringRules}
              result={result}
              selectedBonuses={bonuses}
              onToggleBonus={toggleBonus}
            />
          ) : null}
          {onApplyFan ? (
            <button
              type="button"
              className="hand-scoring-primary-btn hand-scoring-apply-btn"
              disabled={!result.meetsMinFan}
              onClick={() => onApplyFan(result.totalFan)}
            >
              Apply {resultDisplay.main}
              {resultDisplay.limitLabel ? ` ${resultDisplay.limitLabel}` : ''} to game
            </button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
