import { FAN_POINTS } from '@/lib/table-scoring'
import { drawTileIndex, probabilityAtLeastOne, SeededRandom, sumCounts, unseenTileCounts } from '@/lib/mahjong-hk/belief-state'
import { deficiency, effectiveTiles } from '@/lib/mahjong-hk/hand-solver'
import { legalActions } from '@/lib/mahjong-hk/legal-actions'
import type { HkRules } from '@/lib/mahjong-hk/rules/hk-classical-v1'
import { scoreWin } from '@/lib/mahjong-hk/scoring'
import type { LegalAction, ObservedGameState } from '@/lib/mahjong-hk/state'
import { BASE_TILE_IDS, BASE_TILE_INDEX, type BaseTileId } from '@/lib/mahjong-hk/tiles'
import { validateObservedState } from '@/lib/mahjong-hk/validation'

export interface ProbabilityEstimate {
  mean: number
  low95: number
  high95: number
}

export interface ActionEvaluation {
  action: Extract<LegalAction, { type: 'discard' }>
  deficiency: number
  effectiveTypes: number
  effectiveCopies: number
  improveNextDraw: number
  winProbability: ProbabilityEstimate
  expectedFanOnWin: number
  expectedPoints: number
  expectedUtility: number
  rolloutCount: number
}

export interface Recommendation {
  rulesVersion: string
  stateVersion: number
  action: Extract<LegalAction, { type: 'discard' }>
  reasonCodes: string[]
  winProbability: ProbabilityEstimate
  improveNextDraw: number
  expectedPoints: number
  dealInRisk: null
  expectedUtility: number
  alternatives: ActionEvaluation[]
  rolloutCount: number
  elapsedMs: number
  confidence: number
}

export interface RecommendationOptions {
  rollouts?: number
  ownDraws?: number
  seed?: number
  shouldCancel?: () => boolean
}

function wilson(successes: number, total: number): ProbabilityEstimate {
  if (total <= 0) return { mean: 0, low95: 0, high95: 0 }
  const mean = successes / total
  const z = 1.959963984540054
  const denominator = 1 + (z * z) / total
  const centre = (mean + (z * z) / (2 * total)) / denominator
  const margin = (z / denominator) * Math.sqrt((mean * (1 - mean)) / total + (z * z) / (4 * total * total))
  return { mean, low95: Math.max(0, centre - margin), high95: Math.min(1, centre + margin) }
}

function pointsForFan(fan: number): number {
  if (fan >= 13) return FAN_POINTS[13]
  return FAN_POINTS[fan] ?? 0
}

function handKey(counts: Uint8Array): string {
  let key = ''
  for (const count of counts) key += String.fromCharCode(48 + count)
  return key
}

function bestSimulationDiscard(
  state: ObservedGameState,
  cache: Map<string, number>,
): number {
  const key = handKey(state.hand.concealed)
  const cached = cache.get(key)
  if (cached !== undefined) return cached
  let bestIndex = -1
  let lowestRetention = Number.POSITIVE_INFINITY
  for (let index = 0; index < state.hand.concealed.length; index += 1) {
    if (state.hand.concealed[index] === 0) continue
    const count = state.hand.concealed[index]
    let retention = (count - 1) * 5
    if (index < 27) {
      const rank = (index % 9) + 1
      if (rank > 1) retention += state.hand.concealed[index - 1] * 2
      if (rank < 9) retention += state.hand.concealed[index + 1] * 2
      if (rank > 2) retention += state.hand.concealed[index - 2]
      if (rank < 8) retention += state.hand.concealed[index + 2]
      if (rank === 1 || rank === 9) retention -= 0.25
    } else if (count === 1) retention -= 0.5
    if (retention < lowestRetention) {
      bestIndex = index
      lowestRetention = retention
    }
  }
  cache.set(key, bestIndex)
  return bestIndex
}

function simulateDiscard(
  source: ObservedGameState,
  tile: BaseTileId,
  rules: HkRules,
  unseenSource: Uint8Array,
  rollouts: number,
  ownDraws: number,
  seed: number,
  shouldCancel?: () => boolean,
): { wins: number; fanTotal: number; pointsTotal: number; completed: number } {
  let wins = 0
  let fanTotal = 0
  let pointsTotal = 0
  let completed = 0
  const discardIndex = BASE_TILE_INDEX[tile]
  const discardCache = new Map<string, number>()
  for (let rollout = 0; rollout < rollouts; rollout += 1) {
    if ((rollout & 31) === 0 && shouldCancel?.()) break
    const random = new SeededRandom((seed + Math.imul(rollout + 1, 0x9e3779b1)) >>> 0)
    const wall = new Uint8Array(unseenSource)
    const hand = { ...source.hand, concealed: new Uint8Array(source.hand.concealed) }
    hand.concealed[discardIndex] -= 1
    const simulationState = { ...source, hand }
    let won = false
    for (let draw = 0; draw < ownDraws; draw += 1) {
      if (draw > 0) {
        for (let opponentDraw = 0; opponentDraw < 3; opponentDraw += 1) drawTileIndex(wall, random)
      }
      const drawn = drawTileIndex(wall, random)
      if (drawn === null) break
      hand.concealed[drawn] += 1
      const scored = scoreWin(hand, { winType: 'self_draw', winningTile: BASE_TILE_IDS[drawn] }, rules)
      if (scored.valid && scored.meetsMinimum) {
        wins += 1
        fanTotal += scored.fan
        pointsTotal += pointsForFan(scored.fan)
        won = true
        break
      }
      const nextDiscard = bestSimulationDiscard(simulationState, discardCache)
      if (nextDiscard < 0) break
      hand.concealed[nextDiscard] -= 1
    }
    completed += 1
    if (!won) pointsTotal += 0
  }
  return { wins, fanTotal, pointsTotal, completed }
}

export function evaluateDiscards(
  state: ObservedGameState,
  rules: HkRules,
  options: RecommendationOptions = {},
): ActionEvaluation[] {
  const validation = validateObservedState(state)
  if (!validation.valid) throw new Error(validation.errors.join(' '))
  const event = state.lastEvent?.type === 'USER_DRAW_CONFIRMED'
    ? state.lastEvent
    : { type: 'USER_DRAW_CONFIRMED' as const, tile: state.hand.drawnTile ?? BASE_TILE_IDS[0] }
  const actions = legalActions(state, event, rules).filter((action): action is Extract<LegalAction, { type: 'discard' }> => action.type === 'discard')
  if (!actions.length) throw new Error('No legal discard is available for this state.')
  const unseen = unseenTileCounts(state)
  const totalUnseen = sumCounts(unseen)
  const rollouts = Math.max(1, Math.floor(options.rollouts ?? 1200))
  const ownDraws = Math.max(1, Math.floor(options.ownDraws ?? Math.min(8, Math.ceil(state.tilesRemainingEstimate / 4))))
  const seed = options.seed ?? 0x4d41484a

  return actions.map((action, actionIndex) => {
    const concealed = new Uint8Array(state.hand.concealed)
    concealed[BASE_TILE_INDEX[action.tile]] -= 1
    const afterDiscard = { ...state.hand, concealed }
    const nextDeficiency = deficiency(afterDiscard, rules)
    const effective = effectiveTiles(afterDiscard, rules, {
      discardsBySeat: state.discardsBySeat,
      exposedMeldsBySeat: state.exposedMeldsBySeat,
      bonusTilesBySeat: state.bonusTilesBySeat,
    })
    const effectiveCopies = effective.reduce((total, item) => total + item.remaining, 0)
    const simulation = simulateDiscard(
      state,
      action.tile,
      rules,
      unseen,
      rollouts,
      ownDraws,
      (seed + Math.imul(actionIndex + 1, 0x85ebca6b)) >>> 0,
      options.shouldCancel,
    )
    const winProbability = wilson(simulation.wins, simulation.completed)
    const expectedFanOnWin = simulation.wins ? simulation.fanTotal / simulation.wins : 0
    const expectedPoints = simulation.completed ? simulation.pointsTotal / simulation.completed : 0
    const shapeBonus = Math.max(0, 4 - nextDeficiency) * 0.1 + effectiveCopies * 0.002
    const expectedUtility = expectedPoints + shapeBonus
    return {
      action,
      deficiency: nextDeficiency,
      effectiveTypes: effective.length,
      effectiveCopies,
      improveNextDraw: probabilityAtLeastOne(totalUnseen, effectiveCopies, 1),
      winProbability,
      expectedFanOnWin,
      expectedPoints,
      expectedUtility,
      rolloutCount: simulation.completed,
    }
  }).sort((a, b) =>
    b.expectedUtility - a.expectedUtility
    || a.deficiency - b.deficiency
    || b.effectiveCopies - a.effectiveCopies
    || a.action.tile.localeCompare(b.action.tile)
  )
}

export function recommendDiscard(state: ObservedGameState, rules: HkRules, options: RecommendationOptions = {}): Recommendation {
  const started = performance.now()
  const alternatives = evaluateDiscards(state, rules, options)
  const best = alternatives[0]
  const second = alternatives[1]
  const intervalSeparated = !second || best.winProbability.low95 > second.winProbability.high95
  const utilityGap = second ? Math.max(0, best.expectedUtility - second.expectedUtility) : best.expectedUtility
  const confidence = Math.min(1, state.observationConfidence * (intervalSeparated ? 1 : 0.7) * (0.75 + Math.min(0.25, utilityGap / 10)))
  const reasonCodes = [
    `deficiency:${best.deficiency}`,
    `effective:${best.effectiveTypes}:${best.effectiveCopies}`,
    intervalSeparated ? 'simulation:separated' : 'simulation:close',
  ]
  return {
    rulesVersion: rules.id,
    stateVersion: state.version,
    action: best.action,
    reasonCodes,
    winProbability: best.winProbability,
    improveNextDraw: best.improveNextDraw,
    expectedPoints: best.expectedPoints,
    dealInRisk: null,
    expectedUtility: best.expectedUtility,
    alternatives,
    rolloutCount: best.rolloutCount,
    elapsedMs: performance.now() - started,
    confidence,
  }
}
