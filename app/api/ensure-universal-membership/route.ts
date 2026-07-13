import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { ensureSupabaseUniversalMembership } from '@/lib/server/supabase-club-management'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const decoded = await adminAuth.verifyIdToken(token)
    const result = await ensureSupabaseUniversalMembership(decoded.uid)
    return NextResponse.json(result)
  } catch (error) {
    console.error('Universal membership enrollment failed.', error)
    return NextResponse.json({ error: 'Unable to enroll the account in the universal club.' }, { status: 500 })
  }
}
