function pad(value: number) {
  return String(value).padStart(2, '0')
}

export function toDateOnly(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null

  if (typeof value === 'string') {
    const isoDate = value.match(/^(\d{4}-\d{2}-\d{2})(?:$|[T\s])/)
    if (isoDate) return isoDate[1]
  }

  const date = value instanceof Date ? value : new Date(String(value))
  if (!Number.isFinite(date.getTime())) return null
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
