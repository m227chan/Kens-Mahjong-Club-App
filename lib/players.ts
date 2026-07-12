// 14 distinct colors — assigned by index, never by name
export const PLAYER_COLORS = [
  '#F59E0B', // amber
  '#10B981', // emerald
  '#3B82F6', // blue
  '#EC4899', // pink
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#84CC16', // lime
  '#F97316', // orange
  '#EF4444', // red
  '#A78BFA', // purple
  '#34D399', // teal
  '#FCD34D', // yellow
  '#FB7185', // rose
  '#94A3B8', // slate
]

export const PLAYER_EMOJIS = [
  '🀄', '🎴', '🏆', '⭐', '🔥', '🌙', '🍀', '🐉',
  '🧧', '💎', '🦊', '🐼', '🐯', '🌸', '🌊', '🎲'
]

export function randomUnusedPlayerEmoji(used: Set<string>) {
  const available = PLAYER_EMOJIS.filter((emoji) => !used.has(emoji.toLocaleLowerCase()))
  const pool = available.length ? available : PLAYER_EMOJIS
  const emoji = pool[Math.floor(Math.random() * pool.length)]
  used.add(emoji.toLocaleLowerCase())
  return emoji
}

export const RANK_TITLES = [
  'Messiah',
  'Master',
  'Musketeer',
  'Marshal',
  'Monk',
  'Mortal',
  'Minion',
  'Mongrel',
  'Moron'
] as const

const RANK_TITLE_PROPORTIONS = [0.04, 0.07, 0.12, 0.17, 0.20, 0.17, 0.12, 0.07, 0.04] as const

export type RankTitle = (typeof RANK_TITLES)[number]

export function rankTitleBandSizes(totalPlayers: number) {
  const playerCount = Math.max(0, Math.floor(totalPlayers))
  const sizes = RANK_TITLE_PROPORTIONS.map((proportion) => Math.round(playerCount * proportion))
  const assignedPlayers = sizes.reduce((sum, size) => sum + size, 0)

  // All rounding drift belongs to the largest, central band.
  sizes[4] += playerCount - assignedPlayers
  return sizes
}

export function titleForStanding(rank: number, totalPlayers: number, _gamesPlayed?: number): RankTitle {
  const playerCount = Math.max(1, Math.floor(totalPlayers))
  const safeRank = Math.min(playerCount, Math.max(1, Math.floor(rank)))
  const bandSizes = rankTitleBandSizes(playerCount)
  let lastRankInBand = 0

  for (let index = 0; index < bandSizes.length; index += 1) {
    lastRankInBand += bandSizes[index]
    if (safeRank <= lastRankInBand) return RANK_TITLES[index]
  }

  return RANK_TITLES[RANK_TITLES.length - 1]
}

// Colors cycle if player count exceeds palette length
export function assignPlayerColors(
  playerNames: string[]
): Record<string, string> {
  return Object.fromEntries(
    playerNames.map((name, i) => [
      name,
      PLAYER_COLORS[i % PLAYER_COLORS.length]
    ])
  )
}

export function assignTitles(
  rankedPlayers: { name: string; rank: number; roundsPlayed: number }[],
  totalPlayers: number
): Record<string, { title: string; emoji: string }> {
  const titleEmoji: Record<RankTitle, string> = {
    Messiah: '\u{1F451}',
    Master: '\u{1F3C6}',
    Musketeer: '\u{2694}',
    Marshal: '\u{1F396}',
    Monk: '\u{1F9D8}',
    Mortal: '\u{1F464}',
    Minion: '\u{1FA84}',
    Mongrel: '\u{1F415}',
    Moron: '\u{1F921}'
  }

  return Object.fromEntries(
    rankedPlayers.map((player) => {
      const title = titleForStanding(player.rank, totalPlayers, player.roundsPlayed)
      return [player.name, { title, emoji: titleEmoji[title] }]
    })
  )
}