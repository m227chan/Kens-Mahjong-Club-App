import 'server-only'

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

/**
 * Simple in-memory fixed-window rate limiter for Next.js route handlers.
 * Suitable for single-instance / hobby deploys; not shared across replicas.
 */
export function assertRateLimit(options: {
  key: string
  limit: number
  windowMs: number
  message?: string
}) {
  const now = Date.now()
  const existing = buckets.get(options.key)
  if (!existing || now >= existing.resetAt) {
    buckets.set(options.key, { count: 1, resetAt: now + options.windowMs })
    return
  }
  if (existing.count >= options.limit) {
    throw new Error(options.message ?? 'Too many requests. Please wait a moment and try again.')
  }
  existing.count += 1
}

export function clientIpFromRequest(request: { headers: Headers }) {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) {
    const first = forwarded.split(',')[0]?.trim()
    if (first) return first
  }
  const realIp = request.headers.get('x-real-ip')?.trim()
  if (realIp) return realIp
  return 'unknown'
}
