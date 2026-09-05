export function parseFanValue(value: string): number | 'limit' {
  const trimmed = value.trim()
  if (/^limit$/i.test(trimmed)) return 'limit'
  const match = trimmed.match(/^(\d+)\s*fan$/i)
  if (!match) throw new Error(`Unrecognized fan value: ${value}`)
  return Number(match[1])
}

export function fanToNumber(fan: number | 'limit', maxFan: number): number {
  return fan === 'limit' ? maxFan : fan
}
