import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { promoteManager } from '@/lib/server/club-management'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const decoded = await adminAuth.verifyIdToken(token)
    const body = await request.json() as { clubId?: string; email?: string }
    const result = await promoteManager(decoded.uid, body.clubId ?? '', body.email ?? '')
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to promote that manager.'
    const status = message.includes('Only an active') ? 403 : 400
    return NextResponse.json({ error: message }, { status })
  }
}