import 'server-only'

import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

export type GuestTableClaims = {
  clubId: string
  tableNumber: number
  exp: number
  jti: string
}

const TOKEN_PREFIX = 'g1'
const DEFAULT_TTL_MS = 12 * 60 * 60 * 1000

function signingSecret() {
  const value =
    process.env.GUEST_TABLE_SECRET?.trim() ||
    process.env.QR_SIGNING_SECRET?.trim()
  if (!value) throw new Error('GUEST_TABLE_SECRET or QR_SIGNING_SECRET is not configured.')
  if (value.length < 32)
    throw new Error('Guest table signing secret must contain at least 32 characters.')
  return value
}

function encodePayload(claims: GuestTableClaims) {
  return Buffer.from(
    JSON.stringify({
      clubId: claims.clubId,
      tableNumber: claims.tableNumber,
      exp: claims.exp,
      jti: claims.jti,
    }),
    'utf8',
  ).toString('base64url')
}

function signPayload(payload: string) {
  return createHmac('sha256', signingSecret()).update(`${TOKEN_PREFIX}.${payload}`).digest('base64url')
}

export function isGuestTableToken(token: string) {
  return token.startsWith(`${TOKEN_PREFIX}.`)
}

export function signGuestTableToken(input: {
  clubId: string
  tableNumber: number
  ttlMs?: number
}): string {
  const clubId = input.clubId.trim().toUpperCase()
  const tableNumber = Math.min(99, Math.max(1, Math.floor(input.tableNumber)))
  const claims: GuestTableClaims = {
    clubId,
    tableNumber,
    exp: Date.now() + (input.ttlMs ?? DEFAULT_TTL_MS),
    jti: randomBytes(12).toString('hex'),
  }
  const payload = encodePayload(claims)
  return `${TOKEN_PREFIX}.${payload}.${signPayload(payload)}`
}

export function verifyGuestTableToken(token: string): GuestTableClaims {
  const parts = token.trim().split('.')
  if (parts.length !== 3 || parts[0] !== TOKEN_PREFIX)
    throw new Error('Guest access is invalid or expired.')
  const [, payload, supplied] = parts
  const expected = Buffer.from(signPayload(payload))
  const actual = Buffer.from(supplied)
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual))
    throw new Error('Guest access is invalid or expired.')
  let claims: GuestTableClaims
  try {
    claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as GuestTableClaims
  } catch {
    throw new Error('Guest access is invalid or expired.')
  }
  if (
    !claims ||
    typeof claims.clubId !== 'string' ||
    !Number.isFinite(claims.tableNumber) ||
    !Number.isFinite(claims.exp) ||
    typeof claims.jti !== 'string'
  ) {
    throw new Error('Guest access is invalid or expired.')
  }
  if (Date.now() > Number(claims.exp))
    throw new Error('Guest access expired. Start again from Try it on the login page.')
  return {
    clubId: String(claims.clubId).trim().toUpperCase(),
    tableNumber: Math.min(99, Math.max(1, Math.floor(Number(claims.tableNumber)))),
    exp: Number(claims.exp),
    jti: String(claims.jti),
  }
}

export function guestCallerSubject(claims: Pick<GuestTableClaims, 'clubId' | 'tableNumber'>) {
  return `guest:${claims.clubId}:${claims.tableNumber}`
}
