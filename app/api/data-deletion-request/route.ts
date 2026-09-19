import { NextRequest, NextResponse } from 'next/server'
import { apiError, jsonObject } from '@/lib/server/api'
import { LEGAL } from '@/lib/legal'

export const runtime = 'nodejs'

const RATE_WINDOW_MS = 15 * 60 * 1000
const RATE_MAX = 5
const recentByKey = new Map<string, number[]>()

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function clientKey(request: NextRequest, email: string) {
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown'
  return `${ip}:${email.toLowerCase()}`
}

function allowRequest(key: string) {
  const now = Date.now()
  const recent = (recentByKey.get(key) ?? []).filter((stamp) => now - stamp < RATE_WINDOW_MS)
  if (recent.length >= RATE_MAX) {
    recentByKey.set(key, recent)
    return false
  }
  recent.push(now)
  recentByKey.set(key, recent)
  return true
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

export async function POST(request: NextRequest) {
  const resendApiKey = process.env.RESEND_API_KEY
  const emailFrom = process.env.EMAIL_FROM
  const deletionTo =
    process.env.DATA_DELETION_TO?.trim() || LEGAL.contactEmail

  if (!resendApiKey || !emailFrom) {
    return NextResponse.json(
      { error: 'Email service is not configured.' },
      { status: 503 },
    )
  }

  try {
    const body = await jsonObject(request)
    const name = String(body.name ?? '').trim()
    const email = String(body.email ?? '').trim()
    const clubId = String(body.clubId ?? '')
      .trim()
      .toUpperCase()
      .slice(0, 12)
    const details = String(body.details ?? '').trim().slice(0, 2000)

    if (name.length < 2 || name.length > 120) {
      return NextResponse.json({ error: 'Enter your name.' }, { status: 400 })
    }
    if (!isValidEmail(email)) {
      return NextResponse.json(
        { error: 'Enter a valid email address.' },
        { status: 400 },
      )
    }

    const key = clientKey(request, email)
    if (!allowRequest(key)) {
      return NextResponse.json(
        { error: 'Too many requests. Try again later.' },
        { status: 429 },
      )
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [deletionTo],
        reply_to: email,
        subject: `Data deletion request from ${name}`,
        html: `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5"><h2>Data deletion request</h2><p><strong>Name:</strong> ${escapeHtml(name)}</p><p><strong>Email:</strong> ${escapeHtml(email)}</p><p><strong>Club ID:</strong> ${escapeHtml(clubId || '(none)')}</p><p><strong>Details:</strong></p><p>${escapeHtml(details || '(none)')}</p></div>`,
        text: `Data deletion request\nName: ${name}\nEmail: ${email}\nClub ID: ${clubId || '(none)'}\nDetails:\n${details || '(none)'}`,
      }),
    })

    if (!response.ok) {
      console.error('Resend rejected data-deletion email.', {
        status: response.status,
      })
      return NextResponse.json(
        { error: 'Unable to send the deletion request email.' },
        { status: 502 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiError(error, 'Unable to submit the deletion request.')
  }
}
