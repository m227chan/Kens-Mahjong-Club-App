import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { ensureSupabaseUniversalMembership } from '@/lib/server/supabase-club-management'
import { apiError, bearerToken } from '@/lib/server/api'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const decoded = await adminAuth.verifyIdToken(bearerToken(request))
    const result = await ensureSupabaseUniversalMembership(decoded.uid)
    return NextResponse.json(result)
  } catch (error) {
    return apiError(
      error,
      'Unable to enroll the account in the universal club.',
    )
  }
}
