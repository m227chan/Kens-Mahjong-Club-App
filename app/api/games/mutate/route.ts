import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { mutateGameAndRebuild } from '@/lib/server/game-management'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const decoded = await adminAuth.verifyIdToken(token)
    const body = await request.json()
    const result = await mutateGameAndRebuild({ ...body, callerUid: decoded.uid })
    return NextResponse.json(result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to modify that game.'
    return NextResponse.json({ error: message }, { status: message.includes('Only an active') ? 403 : 400 })
  }
}
