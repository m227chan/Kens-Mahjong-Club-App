import 'server-only'

import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_BODY_LIMIT = 64 * 1024

class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function bearerToken(request: NextRequest) {
  const token = request.headers
    .get('authorization')
    ?.match(/^Bearer\s+(.+)$/i)?.[1]
    ?.trim()
  if (!token) throw new ApiError('Authentication required.', 401)
  return token
}

export async function jsonObject(
  request: NextRequest,
  limit = DEFAULT_BODY_LIMIT,
): Promise<Record<string, unknown>> {
  const declaredLength = Number(request.headers.get('content-length') ?? 0)
  if (Number.isFinite(declaredLength) && declaredLength > limit)
    throw new ApiError('Request body is too large.', 413)
  const body = await request.text()
  if (Buffer.byteLength(body, 'utf8') > limit)
    throw new ApiError('Request body is too large.', 413)
  try {
    const value: unknown = JSON.parse(body)
    if (!value || typeof value !== 'object' || Array.isArray(value))
      throw new Error('not an object')
    return value as Record<string, unknown>
  } catch {
    throw new ApiError('Request body must be a JSON object.', 400)
  }
}

export function apiError(error: unknown, fallback: string) {
  if (error instanceof ApiError)
    return NextResponse.json({ error: error.message }, { status: error.status })
  const code = (error as { code?: unknown } | null)?.code
  if (typeof code === 'string' && code.startsWith('auth/'))
    return NextResponse.json(
      { error: 'Authentication is invalid or expired.' },
      { status: 401 },
    )
  const message = error instanceof Error ? error.message : ''
  if (/^Only an active club (?:manager|member) can do that\.$/.test(message))
    return NextResponse.json({ error: message }, { status: 403 })
  if (typeof code === 'string' && /^[0-9A-Z]{5}$/.test(code)) {
    console.error(fallback, error)
    return NextResponse.json({ error: fallback }, { status: 500 })
  }
  if (error instanceof TypeError || error instanceof SyntaxError) {
    console.error(fallback, error)
    return NextResponse.json({ error: fallback }, { status: 400 })
  }
  return NextResponse.json(
    { error: message || fallback },
    { status: 400 },
  )
}
