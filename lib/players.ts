// 14 distinct colors — assigned by index, never by name
import {
  DEFAULT_TITLE_RULES,
  titleBandSizes,
  titleForRank,
  type TitleRules,
} from '@/lib/title-rules'

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

// A broad, platform-safe catalog keeps the picker useful without relying on a
// network request or offering code points that do not render as emoji.
export const PLAYER_EMOJIS = [
  '🀄', '🎴', '🏆', '⭐', '🔥', '🌙', '🍀', '🐉',
  '🧧', '💎', '🦊', '🐼', '🐯', '🌸', '🌊', '🎲',
  '🎯', '🎳', '🥇', '🥈', '🥉', '👑', '⚡', '☀️',
  '🌈', '❄️', '☄️', '✨', '🌟', '💫', '🌻', '🌺',
  '🪷', '🌵', '🍁', '🍄', '🐲', '🦁', '🐸', '🐙',
  '🦋', '🐝', '🦄', '🦅', '🦉', '🐺', '🐬', '🦈',
  '🐢', '🐘', '🦒', '🦓', '🦜', '🦚', '🐿️', '🦔',
  '🐾', '🍎', '🍊', '🍋', '🍉', '🍇', '🍓', '🍒',
  '🍑', '🥝', '🍍', '🥑', '🌽', '🍜', '🍣', '🍙',
  '🥟', '🍪', '🍩', '🍿', '☕', '🧋', '🥁', '🎸',
  '🎺', '🎻', '🎨', '🎭', '🚲', '🚀', '✈️', '⛵',
  '🗻', '🏝️', '🏮', '🪭', '🎏', '🧩', '🪁', '🔮',
  '🪄', '🧿', '🪙', '🗝️', '💡', '😀', '😎', '🤠',
  '🤖', '👻', '👾', '❤️', '💚', '💙', '💜', '🤍',
]

export function randomUnusedPlayerEmojiOptions(
  used: ReadonlySet<string>,
  count = 16,
  random: () => number = Math.random,
) {
  const choices = PLAYER_EMOJIS.filter((emoji) => !used.has(emoji.trim().toLocaleLowerCase()))
  for (let index = choices.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1))
    ;[choices[index], choices[swapIndex]] = [choices[swapIndex], choices[index]]
  }
  return choices.slice(0, Math.max(0, Math.floor(count)))
}

export function randomUnusedPlayerEmoji(used: Set<string>) {
  const available = PLAYER_EMOJIS.filter((emoji) => !used.has(emoji.toLocaleLowerCase()))
  if (!available.length) return ''
  const emoji = available[Math.floor(Math.random() * available.length)]
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

type RankTitle = (typeof RANK_TITLES)[number]

export function rankTitleBandSizes(totalPlayers: number, rules: TitleRules = DEFAULT_TITLE_RULES) {
  return titleBandSizes(totalPlayers, rules)
}

export function titleForStanding(rank: number, totalPlayers: number, _gamesPlayed?: number, rules: TitleRules = DEFAULT_TITLE_RULES) {
  return titleForRank(rank, totalPlayers, rules)
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
  totalPlayers: number,
  rules: TitleRules = DEFAULT_TITLE_RULES,
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
      const title = titleForStanding(player.rank, totalPlayers, player.roundsPlayed, rules)
      return [player.name, { title, emoji: titleEmoji[title as RankTitle] ?? '🏅' }]
    })
  )
}
