export type SessionPointWindowHours = 24 | 48 | 168

export type SessionPointHoursWindow = {
  mode: 'hours'
  hours: SessionPointWindowHours
}

export type SessionPointRangeWindow = {
  mode: 'range'
  /** Inclusive local calendar day as YYYY-MM-DD (display / form state) */
  startDate: string
  /** Inclusive local calendar day as YYYY-MM-DD (display / form state) */
  endDate: string
  /** Inclusive start instant (ISO) */
  startAt: string
  /** Exclusive end instant (ISO) */
  endAt: string
}

export type SessionPointAllWindow = { mode: 'all' }

export type SessionPointWindow =
  | SessionPointHoursWindow
  | SessionPointRangeWindow
  | SessionPointAllWindow

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/
const MAX_RANGE_MS = 366 * 24 * 60 * 60 * 1000

export function isSessionPointWindowHours(
  value: unknown,
): value is SessionPointWindowHours {
  const hours = Number(value)
  return hours === 24 || hours === 48 || hours === 168
}

export function normalizeSessionPointHours(value: unknown): SessionPointWindowHours {
  const hours = Number(value)
  if (hours === 24 || hours === 48 || hours === 168) return hours
  throw new Error('Choose a 24 hour, 48 hour, or 7 day window.')
}

export function todayDateInputValue(now = new Date()) {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseDateInputValue(value: string): {
  year: number
  month: number
  day: number
} | null {
  const match = DATE_RE.exec(value.trim())
  if (!match) return null
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const probe = new Date(year, month - 1, day)
  if (
    !Number.isFinite(probe.getTime()) ||
    probe.getFullYear() !== year ||
    probe.getMonth() !== month - 1 ||
    probe.getDate() !== day
  ) {
    return null
  }
  return { year, month, day }
}

/** Convert inclusive YYYY-MM-DD local dates into an ISO half-open range. */
export function localDateRangeBounds(startDate: string, endDate: string) {
  const start = parseDateInputValue(startDate)
  const end = parseDateInputValue(endDate)
  if (!start || !end) {
    throw new Error('Choose a valid start and end date.')
  }
  const startMs = new Date(start.year, start.month - 1, start.day).getTime()
  const endDayMs = new Date(end.year, end.month - 1, end.day).getTime()
  if (startMs > endDayMs) {
    throw new Error('The start date must be on or before the end date.')
  }
  const startAtMs = new Date(
    start.year,
    start.month - 1,
    start.day,
    0,
    0,
    0,
    0,
  ).getTime()
  const endAtMs = new Date(
    end.year,
    end.month - 1,
    end.day + 1,
    0,
    0,
    0,
    0,
  ).getTime()
  if (endAtMs - startAtMs > MAX_RANGE_MS) {
    throw new Error('Choose a custom window of 366 days or fewer.')
  }
  return {
    startAt: new Date(startAtMs).toISOString(),
    endAt: new Date(endAtMs).toISOString(),
  }
}

export function buildCustomSessionWindow(
  startDate: string,
  endDate: string,
): SessionPointRangeWindow {
  const trimmedStart = startDate.trim()
  const trimmedEnd = endDate.trim()
  const { startAt, endAt } = localDateRangeBounds(trimmedStart, trimmedEnd)
  return {
    mode: 'range',
    startDate: trimmedStart,
    endDate: trimmedEnd,
    startAt,
    endAt,
  }
}

export function hoursSessionWindow(
  hours: SessionPointWindowHours,
): SessionPointHoursWindow {
  return { mode: 'hours', hours }
}

export function allSessionWindow(): SessionPointAllWindow {
  return { mode: 'all' }
}

function normalizeIsoInstant(value: unknown, label: string) {
  const raw = String(value ?? '').trim()
  const ms = Date.parse(raw)
  if (!Number.isFinite(ms)) {
    throw new Error(`Choose a valid ${label}.`)
  }
  return new Date(ms).toISOString()
}

export function normalizeSessionPointWindow(input: {
  hours?: unknown
  mode?: unknown
  startDate?: unknown
  endDate?: unknown
  startAt?: unknown
  endAt?: unknown
}): SessionPointWindow {
  if (input.mode === 'all') return allSessionWindow()

  const wantsRange =
    input.mode === 'range' ||
    (input.startAt != null &&
      String(input.startAt).trim() !== '' &&
      input.endAt != null &&
      String(input.endAt).trim() !== '')

  if (wantsRange) {
    const startAt = normalizeIsoInstant(input.startAt, 'start date')
    const endAt = normalizeIsoInstant(input.endAt, 'end date')
    const startMs = Date.parse(startAt)
    const endMs = Date.parse(endAt)
    if (startMs >= endMs) {
      throw new Error('The start date must be on or before the end date.')
    }
    if (endMs - startMs > MAX_RANGE_MS) {
      throw new Error('Choose a custom window of 366 days or fewer.')
    }
    const startDate = String(input.startDate ?? '').trim()
    const endDate = String(input.endDate ?? '').trim()
    if (!parseDateInputValue(startDate) || !parseDateInputValue(endDate)) {
      throw new Error('Choose a valid start and end date.')
    }
    return {
      mode: 'range',
      startDate,
      endDate,
      startAt,
      endAt,
    }
  }

  return hoursSessionWindow(normalizeSessionPointHours(input.hours ?? 24))
}

export function sessionWindowsEqual(
  left: SessionPointWindow | null | undefined,
  right: SessionPointWindow | null | undefined,
) {
  if (!left || !right) return left === right
  if (left.mode !== right.mode) return false
  if (left.mode === 'hours' && right.mode === 'hours') {
    return left.hours === right.hours
  }
  if (left.mode === 'all' && right.mode === 'all') return true
  if (left.mode === 'range' && right.mode === 'range') {
    return left.startDate === right.startDate && left.endDate === right.endDate
  }
  return false
}

export function sessionWindowPhrase(window: SessionPointWindow) {
  if (window.mode === 'all') return 'all time'
  if (window.mode === 'hours') {
    if (window.hours === 168) return '7 days'
    return `${window.hours} hours`
  }
  if (window.startDate === window.endDate) return window.startDate
  return `${window.startDate} → ${window.endDate}`
}

export function sessionWindowTag(window: SessionPointWindow) {
  if (window.mode === 'all') return 'all'
  if (window.mode === 'hours') {
    if (window.hours === 168) return '7d'
    return `${window.hours}h`
  }
  const start = window.startDate.slice(5)
  const end = window.endDate.slice(5)
  if (window.startDate === window.endDate) return start
  return `${start}–${end}`
}

export function sessionWindowRequestBody(window: SessionPointWindow) {
  if (window.mode === 'all') return { mode: 'all' as const }
  if (window.mode === 'hours') {
    return { mode: 'hours' as const, hours: window.hours }
  }
  return {
    mode: 'range' as const,
    startDate: window.startDate,
    endDate: window.endDate,
    startAt: window.startAt,
    endAt: window.endAt,
  }
}

export function dateIsInSessionWindow(
  date: Date,
  window: SessionPointWindow,
  now = new Date(),
) {
  const time = date.getTime()
  if (!Number.isFinite(time)) return false
  if (window.mode === 'all') return true
  if (window.mode === 'hours')
    return time >= now.getTime() - window.hours * 60 * 60 * 1000 && time <= now.getTime()
  return time >= Date.parse(window.startAt) && time < Date.parse(window.endAt)
}

export function sessionWindowDateBounds(
  window: SessionPointWindow,
  now = new Date(),
) {
  if (window.mode === 'all') return { startAt: null, endAt: null }
  if (window.mode === 'hours') {
    return {
      startAt: new Date(
        now.getTime() - window.hours * 60 * 60 * 1000,
      ).toISOString(),
      endAt: now.toISOString(),
    }
  }
  return { startAt: window.startAt, endAt: window.endAt }
}
