import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { withTransaction } from '@/lib/postgres-admin'
import { createSelfPlayer, exchangeTableQr, getTableContext, linkSelfToPlayer, mutateTable, requestQrEnrollment } from '@/lib/server/table-checkin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const decoded = await adminAuth.verifyIdToken(token)
    const caller = { uid: decoded.uid, email: decoded.email ?? null, name: decoded.name ?? null, picture: decoded.picture ?? null }
    const body = await request.json() as Record<string, unknown>
    const action = String(body.action ?? '')
    const result = await withTransaction(async (db) => {
      if (action === 'exchange') return exchangeTableQr(db, caller, String(body.publicId ?? ''), String(body.signature ?? ''))
      if (action === 'requestEnrollment') return requestQrEnrollment(db, caller, String(body.publicId ?? ''), String(body.signature ?? ''))
      const clubId = String(body.clubId ?? '').trim().toUpperCase()
      if (action === 'context') return getTableContext(db, caller, clubId, Number(body.tableNumber))
      if (action === 'linkSelf') return linkSelfToPlayer(db, caller, clubId, String(body.playerId ?? ''))
      if (action === 'createSelf') return createSelfPlayer(db, caller, clubId, String(body.displayName ?? ''), String(body.icon ?? ''))
      if (['checkIn', 'seat', 'remove', 'clear', 'clearAll'].includes(action)) return mutateTable(db, caller, {
        action: action as 'checkIn' | 'seat' | 'remove' | 'clear' | 'clearAll',
        clubId,
        tableNumber: Number(body.tableNumber),
        playerId: body.playerId ? String(body.playerId) : undefined,
        replacePlayerId: body.replacePlayerId ? String(body.replacePlayerId) : undefined
      })
      throw new Error('Unsupported table action.')
    })
    return NextResponse.json({ result })
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Unable to update this table.' }, { status: 400 })
  }
}
