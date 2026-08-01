export type TitleRuleMode = 'proportion' | 'count'

export interface TitleBandRule {
  id: string
  title: string
  value: number
  remainder?: boolean
}

export interface TitleRules {
  mode: TitleRuleMode
  bands: TitleBandRule[]
}

export const DEFAULT_TITLE_RULES: TitleRules = {
  mode: 'proportion',
  bands: [
    { id: 'messiah', title: 'Messiah', value: 4 },
    { id: 'master', title: 'Master', value: 7 },
    { id: 'musketeer', title: 'Musketeer', value: 12 },
    { id: 'marshal', title: 'Marshal', value: 17 },
    { id: 'monk', title: 'Monk', value: 20, remainder: true },
    { id: 'mortal', title: 'Mortal', value: 17 },
    { id: 'minion', title: 'Minion', value: 12 },
    { id: 'mongrel', title: 'Mongrel', value: 7 },
    { id: 'moron', title: 'Moron', value: 4 },
  ],
}

const MAX_TITLES = 25
const MAX_TITLE_LENGTH = 40
const MAX_COUNT = 1_000

export function validateTitleRules(value: unknown): TitleRules {
  if (!value || typeof value !== 'object')
    throw new Error('Title rules are required.')
  const input = value as Record<string, unknown>
  const mode = input.mode
  if (mode !== 'proportion' && mode !== 'count')
    throw new Error('Choose proportional or exact-count title rules.')
  if (!Array.isArray(input.bands) || input.bands.length < 1 || input.bands.length > MAX_TITLES)
    throw new Error(`Add between 1 and ${MAX_TITLES} titles.`)

  const seenIds = new Set<string>()
  const seenTitles = new Set<string>()
  const bands = input.bands.map((raw, index): TitleBandRule => {
    if (!raw || typeof raw !== 'object') throw new Error(`Title ${index + 1} is invalid.`)
    const band = raw as Record<string, unknown>
    const title = String(band.title ?? '').trim().slice(0, MAX_TITLE_LENGTH)
    if (!title) throw new Error(`Enter a name for title ${index + 1}.`)
    const titleKey = title.toLocaleLowerCase()
    if (seenTitles.has(titleKey)) throw new Error(`Title names must be unique: ${title}.`)
    seenTitles.add(titleKey)

    const rawId = String(band.id ?? '').trim().toLocaleLowerCase()
    const baseId = rawId.replace(/[^a-z0-9_-]/g, '').slice(0, 64) || `title-${index + 1}`
    let id = baseId
    while (seenIds.has(id)) id = `${baseId}-${index + 1}`
    seenIds.add(id)

    const number = Number(band.value)
    if (!Number.isFinite(number) || number < 0)
      throw new Error(`Enter a valid allocation for ${title}.`)
    if (mode === 'count' && (!Number.isSafeInteger(number) || number > MAX_COUNT))
      throw new Error(`The count for ${title} must be a whole number from 0 to ${MAX_COUNT}.`)
    if (mode === 'proportion' && number > 100)
      throw new Error(`The proportion for ${title} must be from 0% to 100%.`)
    return { id, title, value: number, ...(Boolean(band.remainder) ? { remainder: true } : {}) }
  })

  if (mode === 'proportion') {
    const total = bands.reduce((sum, band) => sum + band.value, 0)
    if (Math.abs(total - 100) > 0.01)
      throw new Error(`Title proportions must total 100% (currently ${Math.round(total * 100) / 100}%).`)
    return {
      mode,
      bands: bands.map((band) => ({ id: band.id, title: band.title, value: band.value })),
    }
  }

  const remainderBands = bands.filter((band) => band.remainder)
  if (remainderBands.length !== 1)
    throw new Error('Choose exactly one title to fill all ranks not covered by top or bottom counts.')
  return { mode, bands }
}

export function titleRulesFromRow(row: Record<string, unknown> | null | undefined) {
  if (!row) return DEFAULT_TITLE_RULES
  try {
    return validateTitleRules(row.title_bands)
  } catch {
    return DEFAULT_TITLE_RULES
  }
}

export function titleBandSizes(totalPlayers: number, rules: TitleRules = DEFAULT_TITLE_RULES) {
  const playerCount = Math.max(0, Math.floor(totalPlayers))
  if (!playerCount) return rules.bands.map(() => 0)

  if (rules.mode === 'proportion') {
    const sizes = rules.bands.map((band) => Math.round(playerCount * band.value / 100))
    const assigned = sizes.reduce((sum, size) => sum + size, 0)
    const remainderIndex = rules.bands.reduce(
      (largest, band, index) => band.value > rules.bands[largest].value ? index : largest,
      0,
    )
    const drift = playerCount - assigned
    if (sizes[remainderIndex] + drift >= 0) {
      sizes[remainderIndex] += drift
    } else {
      let excess = -drift
      const reductionOrder = sizes
        .map((size, index) => ({ size, index }))
        .sort((left, right) => right.size - left.size || left.index - right.index)
      for (const candidate of reductionOrder) {
        const reduction = Math.min(sizes[candidate.index], excess)
        sizes[candidate.index] -= reduction
        excess -= reduction
        if (!excess) break
      }
    }
    return sizes
  }

  const remainderIndex = Math.max(0, rules.bands.findIndex((band) => band.remainder))
  const sizes = rules.bands.map(() => 0)
  let remaining = playerCount
  for (let index = 0; index < remainderIndex; index += 1) {
    sizes[index] = Math.min(rules.bands[index].value, remaining)
    remaining -= sizes[index]
  }
  for (let index = rules.bands.length - 1; index > remainderIndex; index -= 1) {
    sizes[index] = Math.min(rules.bands[index].value, remaining)
    remaining -= sizes[index]
  }
  sizes[remainderIndex] = remaining
  return sizes
}

export function titleForRank(rank: number, totalPlayers: number, rules: TitleRules = DEFAULT_TITLE_RULES) {
  const playerCount = Math.max(1, Math.floor(totalPlayers))
  const safeRank = Math.min(playerCount, Math.max(1, Math.floor(rank)))
  const sizes = titleBandSizes(playerCount, rules)
  let lastRank = 0
  for (let index = 0; index < sizes.length; index += 1) {
    lastRank += sizes[index]
    if (safeRank <= lastRank) return rules.bands[index].title
  }
  return rules.bands[rules.bands.length - 1]?.title ?? 'Player'
}
