import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'

type FirestoreValue = {
  stringValue?: string
  integerValue?: string
  booleanValue?: boolean
  timestampValue?: string
  nullValue?: null
}

type FirestoreDocument = {
  fields?: Record<string, FirestoreValue>
}

function getString(document: FirestoreDocument, field: string) {
  return document.fields?.[field]?.stringValue ?? ''
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function getUidFromToken(token: string) {
  const [, payload] = token.split('.')
  if (!payload) return ''

  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as { user_id?: string; sub?: string }
    return decoded.user_id ?? decoded.sub ?? ''
  } catch {
    return ''
  }
}

async function getFirestoreDocument(path: string, token: string) {
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  if (!projectId) {
    throw new Error('Missing NEXT_PUBLIC_FIREBASE_PROJECT_ID.')
  }

  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(projectId)}/databases/(default)/documents/${path}`
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  })

  if (!response.ok) {
    return null
  }

  return response.json() as Promise<FirestoreDocument>
}

export async function POST(request: NextRequest) {
  const resendApiKey = process.env.RESEND_API_KEY
  const emailFrom = process.env.EMAIL_FROM
  if (!resendApiKey || !emailFrom) {
    return NextResponse.json({ error: 'Email service is not configured.' }, { status: 503 })
  }

  const authorization = request.headers.get('authorization') ?? ''
  const token = authorization.startsWith('Bearer ') ? authorization.slice('Bearer '.length).trim() : ''
  const uid = getUidFromToken(token)
  if (!token || !uid) {
    return NextResponse.json({ error: 'Missing Firebase authorization token.' }, { status: 401 })
  }

  const body = await request.json().catch(() => null) as { clubId?: string; appUrl?: string } | null
  const clubId = body?.clubId?.trim().toUpperCase()
  if (!clubId) {
    return NextResponse.json({ error: 'Missing club ID.' }, { status: 400 })
  }

  const [club, joinRequest] = await Promise.all([
    getFirestoreDocument(`clubs/${encodeURIComponent(clubId)}`, token),
    getFirestoreDocument(`clubs/${encodeURIComponent(clubId)}/joinRequests/${encodeURIComponent(uid)}`, token)
  ])

  if (!club || !joinRequest) {
    return NextResponse.json({ error: 'Join request was not found or is not accessible.' }, { status: 404 })
  }

  const requestStatus = getString(joinRequest, 'status')
  if (requestStatus !== 'pending') {
    return NextResponse.json({ error: 'Join request is not pending.' }, { status: 409 })
  }

  const managerEmail = getString(club, 'managerEmail')
  if (!managerEmail) {
    return NextResponse.json({ error: 'Club manager does not have an email address.' }, { status: 422 })
  }

  const clubName = getString(club, 'name') || clubId
  const requesterName = getString(joinRequest, 'displayName') || getString(joinRequest, 'email') || 'A player'
  const requesterEmail = getString(joinRequest, 'email')
  const appUrl = (body?.appUrl || process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin).replace(/\/$/, '')
  const reviewUrl = `${appUrl}/club/${encodeURIComponent(clubId)}?request=${encodeURIComponent(uid)}`
  const safeClubName = escapeHtml(clubName)
  const safeRequesterName = escapeHtml(requesterName)
  const safeRequesterEmail = escapeHtml(requesterEmail)

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: emailFrom,
      to: [managerEmail],
      subject: `${requesterName} requested to join ${clubName}`,
      html: `
        <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
          <h2 style="margin: 0 0 12px;">New club join request</h2>
          <p><strong>${safeRequesterName}</strong>${safeRequesterEmail ? ` (${safeRequesterEmail})` : ''} requested to join <strong>${safeClubName}</strong>.</p>
          <p>
            <a href="${reviewUrl}" style="display: inline-block; background: #0f766e; color: #ffffff; padding: 10px 14px; border-radius: 8px; text-decoration: none; font-weight: 700;">
              Review request
            </a>
          </p>
          <p style="color: #64748b; font-size: 13px;">You will be asked to sign in before approving or declining the request.</p>
        </div>
      `,
      text: `${requesterName}${requesterEmail ? ` (${requesterEmail})` : ''} requested to join ${clubName}. Review it here: ${reviewUrl}`
    })
  })

  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    return NextResponse.json({ error: 'Resend rejected the email request.', details: result }, { status: 502 })
  }

  return NextResponse.json({ ok: true })
}
