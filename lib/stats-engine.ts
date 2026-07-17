export interface TitleBand {
  minPoints: number
  maxPoints: number
  title: string
}

interface EloRoundEntry {
  playerId: string
  score: number
  ratingBefore: number
  gamesPlayed?: number
}

interface EloRoundResult {
  playerId: string
  ratingBefore: number
  delta: number
  ratingAfter: number
  kFactor: number
  marginMultiplier: number
  opponents: Array<{
    playerId: string
    marginMultiplier: number
    expectedScore: number
    actualScore: number
    pairDelta: number
  }>
}

interface PlayerStatsLike {
  playerId: string
  eloRating: number
  totalPoints: number
}

export interface AppConfigLike {
  eloBaseK?: number
  eloVeteranGamesThreshold?: number
  eloStartingRating?: number
  eloNewPlayerGamesThreshold?: number
  eloNewPlayerK?: number
  eloIntermediateK?: number
}

export function assignTitle(totalPoints: number, bands: TitleBand[]): string {
  for (const band of bands) {
    if (totalPoints >= band.minPoints && totalPoints <= band.maxPoints) {
      return band.title
    }
  }

  return bands[bands.length - 1]?.title ?? 'Monk'
}

function getKFactor(
  gamesPlayed: number | undefined,
  config: AppConfigLike = {},
) {
  const newPlayerThreshold = config.eloNewPlayerGamesThreshold ?? 20
  const veteranThreshold = config.eloVeteranGamesThreshold ?? 50
  const newPlayerK = config.eloNewPlayerK ?? 40
  const intermediateK = config.eloIntermediateK ?? 20
  const veteranK = config.eloBaseK ?? 16

  if (gamesPlayed === undefined) return veteranK
  if (gamesPlayed < newPlayerThreshold) return newPlayerK
  if (gamesPlayed < veteranThreshold) return intermediateK
  return veteranK
}

export function calculateRoundEloDeltas(
  entries: EloRoundEntry[],
  config: AppConfigLike = {},
): EloRoundResult[] {
  const totals = new Map<
    string,
    {
      ratingBefore: number
      delta: number
      opponents: Array<{
        playerId: string
        marginMultiplier: number
        expectedScore: number
        actualScore: number
        pairDelta: number
      }>
      marginMultipliers: number[]
    }
  >()

  entries.forEach((entry) => {
    totals.set(entry.playerId, {
      ratingBefore: entry.ratingBefore,
      delta: 0,
      opponents: [],
      marginMultipliers: [],
    })
  })

  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      const left = entries[i]
      const right = entries[j]
      const spread = Math.abs(left.score - right.score)
      const marginMultiplier = 1.0 + Math.log10(1 + spread / 32)
      const kLeft = getKFactor(left.gamesPlayed, config)
      const kRight = getKFactor(right.gamesPlayed, config)
      const matchK = (kLeft + kRight) / 2

      const expectedLeft =
        1 / (1 + 10 ** ((right.ratingBefore - left.ratingBefore) / 400))
      const expectedRight = 1 - expectedLeft

      const actualLeft =
        left.score > right.score ? 1 : left.score < right.score ? 0 : 0.5
      const actualRight = 1 - actualLeft

      const pairDeltaLeft =
        matchK * marginMultiplier * (actualLeft - expectedLeft)
      const pairDeltaRight =
        matchK * marginMultiplier * (actualRight - expectedRight)

      const leftState = totals.get(left.playerId)!
      const rightState = totals.get(right.playerId)!

      leftState.delta += pairDeltaLeft
      rightState.delta += pairDeltaRight
      leftState.marginMultipliers.push(marginMultiplier)
      rightState.marginMultipliers.push(marginMultiplier)

      leftState.opponents.push({
        playerId: right.playerId,
        marginMultiplier,
        expectedScore: expectedLeft,
        actualScore: actualLeft,
        pairDelta: pairDeltaLeft,
      })
      rightState.opponents.push({
        playerId: left.playerId,
        marginMultiplier,
        expectedScore: expectedRight,
        actualScore: actualRight,
        pairDelta: pairDeltaRight,
      })
    }
  }

  return Array.from(totals.entries()).map(([playerId, state]) => {
    const averageMarginMultiplier =
      state.marginMultipliers.reduce((sum, value) => sum + value, 0) /
      Math.max(1, state.marginMultipliers.length)

    return {
      playerId,
      ratingBefore: state.ratingBefore,
      delta: Math.round(state.delta),
      ratingAfter: Math.round(state.ratingBefore + state.delta),
      kFactor: getKFactor(
        entries.find((entry) => entry.playerId === playerId)?.gamesPlayed ?? 0,
        config,
      ),
      marginMultiplier: Number(averageMarginMultiplier.toFixed(3)),
      opponents: state.opponents,
    }
  })
}

export function computeGlobalRanks(items: PlayerStatsLike[]): {
  eloRanks: Record<string, number>
  pointsRanks: Record<string, number>
} {
  const eloRanks = buildRanks(items, (item) => item.eloRating)
  const pointsRanks = buildRanks(items, (item) => item.totalPoints)

  return { eloRanks, pointsRanks }
}

function buildRanks(
  items: PlayerStatsLike[],
  selector: (item: PlayerStatsLike) => number,
): Record<string, number> {
  const ordered = [...items].sort(
    (left, right) => selector(right) - selector(left),
  )
  const ranks: Record<string, number> = {}
  let currentRank = 1
  let previousValue: number | undefined

  ordered.forEach((item, index) => {
    const value = selector(item)
    if (previousValue === undefined || value !== previousValue) {
      currentRank = index + 1
    }

    ranks[item.playerId] = currentRank
    previousValue = value
  })

  return ranks
}
