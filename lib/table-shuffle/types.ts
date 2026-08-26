export type ShuffleMode =
  | 'fullRandom'
  | 'sharkRedemption'
  | 'nemesis'
  | 'neverMet'
  | 'skillBalance'
  | 'standingsBalance'

export const SHUFFLE_MODES: ShuffleMode[] = [
  'fullRandom',
  'sharkRedemption',
  'nemesis',
  'neverMet',
  'skillBalance',
  'standingsBalance',
]

export const DEFAULT_SHUFFLE_MODE: ShuffleMode = 'fullRandom'

export const DEFAULT_SKILL_RATING = 1500

export type ShuffleMetrics = {
  /** Session-window net points by player id (shark / standings signals). */
  sessionNetByPlayer: Record<string, number>
  /** Skill rating by player id. */
  skillByPlayer: Record<string, number>
  /** Season / standings total points by player id. */
  pointsByPlayer: Record<string, number>
  /**
   * Absolute historical net differential for sorted pair key `a::b`.
   * Missing keys mean no recorded rivalry (treated as expensive for Nemesis).
   */
  absNetByPair: Record<string, number>
  /**
   * Shared-game count for sorted pair key `a::b`.
   * Missing keys are treated as 0 (never met).
   */
  coPlayByPair: Record<string, number>
}

export type ShuffleInput = {
  tables: Record<string, string[]>
  mode: ShuffleMode
  metrics?: Partial<ShuffleMetrics>
  /** Injected RNG for tests. Defaults to Math.random. */
  random?: () => number
}

export type ShuffleResult = {
  tables: Record<string, string[]>
  touchedTableIds: string[]
  skippedTableIds: string[]
  poolSize: number
}

export type ShuffleModeMeta = {
  id: ShuffleMode
  label: string
  description: string
}

export const SHUFFLE_MODE_META: ShuffleModeMeta[] = [
  {
    id: 'fullRandom',
    label: 'Full Random',
    description: 'Reseat everyone at random across the full tables.',
  },
  {
    id: 'sharkRedemption',
    label: 'Shark Tank vs Redemption',
    description: 'Top session scorers share tables; bottom scorers share tables.',
  },
  {
    id: 'nemesis',
    label: 'Nemesis',
    description: 'Seat players with the tightest historical point differentials together.',
  },
  {
    id: 'neverMet',
    label: 'Never Met',
    description: 'Prefer seating players who have shared the fewest games.',
  },
  {
    id: 'skillBalance',
    label: 'Skill Balance',
    description: 'Spread similar Skill ratings across tables.',
  },
  {
    id: 'standingsBalance',
    label: 'Standings Balance',
    description: 'Spread similar season point totals across tables.',
  },
]
