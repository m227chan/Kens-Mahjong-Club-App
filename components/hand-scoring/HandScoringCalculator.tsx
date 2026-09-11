'use client'

import { useEffect, useMemo, useState } from 'react'
import { calculateFan } from '@/lib/hand-scoring/calculate-fan'
import {
  enumerateHandGroupings,
  preferHandGrouping,
  transferConcealment,
  type HandGrouping,
} from '@/lib/hand-scoring/flat-hand-input'
import { isCompleteHand } from '@/lib/hand-scoring/hand-complete'
import { meldsFitInTiles } from '@/lib/hand-scoring/path-wizard'
import { totalFanDisplay } from '@/lib/hand-scoring/total-fan-display'
import type { HandScoringInput, Meld, Wind } from '@/lib/hand-scoring/types'
import { subscribeScoringRules, subscribeUserClubs } from '@/lib/data'
import { DEFAULT_SCORING_RULES, type ScoringRules } from '@/lib/scoring-rules'
import type { ClubMembershipDoc } from '@/lib/types'
import { useAuth } from '@/contexts/AuthContext'
import type { MahjongTileId } from '@/components/MahjongTile'
import BonusScenarioPicker from './BonusScenarioPicker'
import FlowerPicker from './FlowerPicker'
import HandTileBuilder from './HandTileBuilder'
import PathsWizard from './PathsWizard'
import ScoringBreakdown from './ScoringBreakdown'
import WindSelector from './WindSelector'

type CalculatorMode = 'calculate' | 'paths'

export type HandScoringCalculatorProps = {
  clubId?: string | null
  scoringRules?: ScoringRules
  onApplyFan?: (fan: number) => void
  embedded?: boolean
  initialSeatWind?: Wind
  initialRoundWind?: Wind
}

function tilesFingerprint(tiles: MahjongTileId[]): string {
  return [...tiles].sort().join(',')
}

export default function HandScoringCalculator({
  clubId: initialClubId = null,
  scoringRules: initialRules,
  onApplyFan,
  embedded = false,
  initialSeatWind = 'east',
  initialRoundWind = 'east',
}: HandScoringCalculatorProps) {
  const { user } = useAuth()
  const [mode, setMode] = useState<CalculatorMode>('calculate')
  const [clubOptions, setClubOptions] = useState<ClubMembershipDoc[]>([])
  const [selectedClubId, setSelectedClubId] = useState<string | null>(initialClubId)
  const [scoringRules, setScoringRules] = useState<ScoringRules>(initialRules ?? DEFAULT_SCORING_RULES)
  const [seatWind, setSeatWind] = useState<Wind>(initialSeatWind)
  const [roundWind, setRoundWind] = useState<Wind>(initialRoundWind)
  const [flowers, setFlowers] = useState<MahjongTileId[]>([])
  const [tiles, setTiles] = useState<MahjongTileId[]>([])
  const [groupingIndex, setGroupingIndex] = useState(0)
  const [activeGrouping, setActiveGrouping] = useState<HandGrouping | null>(null)
  const [pathsTiles, setPathsTiles] = useState<MahjongTileId[]>([])
  const [pathsOpenMelds, setPathsOpenMelds] = useState<Meld[]>([])
  const [bonuses, setBonuses] = useState<Set<string>>(new Set())
  const [includeNonTraditional, setIncludeNonTraditional] = useState(true)

  useEffect(() => {
    if (initialClubId) setSelectedClubId(initialClubId)
  }, [initialClubId])

  useEffect(() => {
    if (initialRules) setScoringRules(initialRules)
  }, [initialRules])

  useEffect(() => {
    setSeatWind(initialSeatWind)
  }, [initialSeatWind])

  useEffect(() => {
    setRoundWind(initialRoundWind)
  }, [initialRoundWind])

  useEffect(() => {
    if (initialClubId || !user?.uid) return undefined
    return subscribeUserClubs(user.uid, setClubOptions)
  }, [initialClubId, user?.uid])

  useEffect(() => {
    if (!selectedClubId || initialRules) return undefined
    return subscribeScoringRules(selectedClubId, setScoringRules)
  }, [selectedClubId, initialRules])

  const groupings = useMemo(() => enumerateHandGroupings(tiles), [tiles])
  const tilesKey = useMemo(() => tilesFingerprint(tiles), [tiles])

  useEffect(() => {
    if (groupings.length === 0) {
      setActiveGrouping(null)
      setGroupingIndex(0)
      return
    }

    const preferred = preferHandGrouping(groupings, { includeNonTraditional })
    setGroupingIndex(preferred)
    setActiveGrouping((previous) => {
      const next = groupings[preferred]
      if (!previous) return next
      return {
        ...next,
        melds: transferConcealment(previous.melds, next.melds),
      }
    })
  }, [tilesKey, includeNonTraditional, groupings])

  const melds = activeGrouping?.melds ?? []
  const pair = activeGrouping?.pair ?? []
  const handIsValid = useMemo(
    () => Boolean(activeGrouping) && isCompleteHand({ melds, pair: pair.length ? pair : undefined }),
    [activeGrouping, melds, pair],
  )

  const calculateInput = useMemo<HandScoringInput>(
    () => ({
      seatWind,
      roundWind,
      flowers,
      melds,
      pair: pair.length ? pair : undefined,
      bonuses,
      includeNonTraditional,
    }),
    [seatWind, roundWind, flowers, melds, pair, bonuses, includeNonTraditional],
  )

  const result = useMemo(() => calculateFan(calculateInput, scoringRules), [calculateInput, scoringRules])
  const resultDisplay = useMemo(() => totalFanDisplay(result, scoringRules), [result, scoringRules])

  const handleToggleMeldConcealed = (index: number) => {
    setActiveGrouping((current) => {
      if (!current) return current
      return {
        ...current,
        melds: current.melds.map((meld, meldIndex) =>
          meldIndex === index ? { ...meld, concealed: !meld.concealed } : meld,
        ),
      }
    })
  }

  const handleSwapGrouping = () => {
    if (groupings.length <= 1) return
    const nextIndex = (groupingIndex + 1) % groupings.length
    setGroupingIndex(nextIndex)
    setActiveGrouping((previous) => {
      const next = groupings[nextIndex]
      if (!previous) return next
      return {
        ...next,
        melds: transferConcealment(previous.melds, next.melds),
      }
    })
  }

  const handlePathsTilesChange = (nextTiles: MahjongTileId[]) => {
    setPathsTiles(nextTiles)
    setPathsOpenMelds((current) => current.filter((meld) => meldsFitInTiles(nextTiles, [meld])))
  }

  return (
    <div className={`hand-scoring-calculator${embedded ? ' is-embedded' : ''}`}>
      <header className="hand-scoring-header">
        <div>
          <p className="hand-scoring-kicker">Score Calculator</p>
          <h2 id="score-calculator-title" className="hand-scoring-title">Calculate fan and Hand helper</h2>
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
          Hand helper
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

      {mode === 'calculate' ? (
        <div className="hand-scoring-layout">
          <div className="hand-scoring-inputs">
            <WindSelector
              seatWind={seatWind}
              roundWind={roundWind}
              onSeatWindChange={setSeatWind}
              onRoundWindChange={setRoundWind}
            />
            <FlowerPicker seatWind={seatWind} selected={flowers} onChange={setFlowers} />
            <HandTileBuilder
              tiles={tiles}
              onChange={setTiles}
              melds={melds}
              pair={pair.length ? pair : undefined}
              groupingCount={groupings.length}
              groupingIndex={groupingIndex}
              handIsValid={handIsValid}
              onToggleMeldConcealed={handleToggleMeldConcealed}
              onSwapGrouping={handleSwapGrouping}
            />
            <BonusScenarioPicker selected={bonuses} onChange={setBonuses} />
          </div>

          <div className="hand-scoring-results">
            <ScoringBreakdown
              result={result}
              rules={scoringRules}
              melds={melds}
              pair={pair}
              hasHandTiles={tiles.length > 0}
            />
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
      ) : (
        <div className="hand-scoring-paths-layout">
          <div className="hand-scoring-inputs">
            <WindSelector
              seatWind={seatWind}
              roundWind={roundWind}
              onSeatWindChange={setSeatWind}
              onRoundWindChange={setRoundWind}
            />
            <FlowerPicker seatWind={seatWind} selected={flowers} onChange={setFlowers} />
          </div>
          <PathsWizard
            tiles={pathsTiles}
            openMelds={pathsOpenMelds}
            flowers={flowers}
            seatWind={seatWind}
            roundWind={roundWind}
            includeNonTraditional={includeNonTraditional}
            rules={scoringRules}
            onTilesChange={handlePathsTilesChange}
            onOpenMeldsChange={setPathsOpenMelds}
          />
        </div>
      )}
    </div>
  )
}
