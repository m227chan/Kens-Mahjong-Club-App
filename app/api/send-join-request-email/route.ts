import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { withTransaction } from '@/lib/postgres-admin'
import { apiError, bearerToken, jsonObject } from '@/lib/server/api'

export const runtime = 'nodejs'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export async function POST(request: NextRequest) {
  const resendApiKey = process.env.RESEND_API_KEY,
    emailFrom = process.env.EMAIL_FROM
  if (!resendApiKey || !emailFrom)
    return NextResponse.json(
      { error: 'Email service is not configured.' },
      { status: 503 },
    )
  try {
    const decoded = await adminAuth.verifyIdToken(bearerToken(request))
    const body = await jsonObject(request)
    const clubId = String(body.clubId ?? '')
      .trim()
      .toUpperCase()
    if (!clubId)
      return NextResponse.json({ error: 'Missing club ID.' }, { status: 400 })

    const data = await withTransaction(async (db) => {
      const result = await db.query(
        `select c.name,c.manager_email,r.email requester_email,r.display_name requester_name,r.status
        from clubs c join join_requests r on r.club_id=c.id where c.id=$1 and r.firebase_uid=$2`,
        [clubId, decoded.uid],
      )
      return result.rows[0] as
        | {
            name: string
            manager_email: string | null
            requester_email: string | null
            requester_name: string | null
            status: string
          }
        | undefined
    })
    if (!data)
      return NextResponse.json(
        { error: 'Join request was not found or is not accessible.' },
        { status: 404 },
      )
    if (data.status !== 'pending')
      return NextResponse.json(
        { error: 'Join request is not pending.' },
        { status: 409 },
      )
    if (!data.manager_email)
      return NextResponse.json(
        { error: 'Club manager does not have an email address.' },
        { status: 422 },
      )

    const requesterName =
      data.requester_name || data.requester_email || 'A player'
    const appUrl = (
      process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
    ).replace(/\/$/, '')
    if (
      process.env.NODE_ENV === 'production' &&
      new URL(appUrl).protocol !== 'https:'
    ) {
      throw new Error('NEXT_PUBLIC_APP_URL must use HTTPS.')
    }
    const reviewUrl = `${appUrl}/club/${encodeURIComponent(clubId)}?request=${encodeURIComponent(decoded.uid)}`
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: emailFrom,
        to: [data.manager_email],
        subject: `${requesterName} requested to join ${data.name}`,
        html: `<div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.5"><h2>New club join request</h2><p><strong>${escapeHtml(requesterName)}</strong>${data.requester_email ? ` (${escapeHtml(data.requester_email)})` : ''} requested to join <strong>${escapeHtml(data.name)}</strong>.</p><p><a href="${reviewUrl}" style="display:inline-block;background:#0f766e;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:700">Review request</a></p></div>`,
        text: `${requesterName}${data.requester_email ? ` (${data.requester_email})` : ''} requested to join ${data.name}. Review it here: ${reviewUrl}`,
      }),
    })
    if (!response.ok) {
      console.error('Resend rejected join-request email.', {
        status: response.status,
      })
      return NextResponse.json(
        { error: 'Resend rejected the email request.' },
        { status: 502 },
      )
    }
    return NextResponse.json({ ok: true })
  } catch (error) {
    return apiError(error, 'Unable to send the join request email.')
  }
}
