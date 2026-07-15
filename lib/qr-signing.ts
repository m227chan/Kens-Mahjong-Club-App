import 'server-only'

import { createHmac, timingSafeEqual } from 'node:crypto'

type QrIdentity = { clubId: string; tableNumber: number; tokenVersion: number; publicId: string }

function signingSecret() {
  const value = process.env.QR_SIGNING_SECRET?.trim()
    || process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
    || process.env.SUPABASE_DATABASE_URL?.trim()
  if (!value) throw new Error('QR_SIGNING_SECRET is not configured.')
  return value
}

function payload(value: QrIdentity) {
  return `v1:${value.clubId}:${value.tableNumber}:${value.tokenVersion}:${value.publicId}`
}

export function signTableQr(value: QrIdentity) {
  return createHmac('sha256', signingSecret()).update(payload(value)).digest('base64url')
}

export function verifyTableQr(value: QrIdentity, suppliedSignature: string) {
  const expected = Buffer.from(signTableQr(value))
  const supplied = Buffer.from(suppliedSignature.trim())
  return expected.length === supplied.length && timingSafeEqual(expected, supplied)
}

export function tableQrUrl(origin: string, value: QrIdentity) {
  const base = (process.env.NEXT_PUBLIC_APP_URL?.trim() || origin).replace(/\/$/, '')
  return `${base}/check-in/${encodeURIComponent(value.publicId)}#k=${signTableQr(value)}`
}
