import { NextRequest, NextResponse } from 'next/server'
import { withTransaction } from '@/lib/postgres-admin'
import { apiError, jsonObject } from '@/lib/server/api'
import { enterGuestTable, validateGuestClub } from '@/lib/server/guest-table'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await jsonObject(request)
    const action = String(body.action ?? '')
    const result = await withTransaction(async (db) => {
      if (action === 'validateClub')
        return validateGuestClub(db, String(body.clubId ?? ''))
      if (action === 'enter')
        return enterGuestTable(
          db,
          String(body.clubId ?? ''),
          Number(body.tableNumber),
        )
      throw new Error('Unsupported guest table action.')
    })
    return NextResponse.json({ result })
  } catch (error) {
    return apiError(error, 'Unable to continue as a guest.')
  }
}
