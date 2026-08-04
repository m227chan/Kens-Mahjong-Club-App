import { NextRequest, NextResponse } from 'next/server'
import { withTransaction } from '@/lib/postgres-admin'
import { apiError, jsonObject } from '@/lib/server/api'
import {
  assertGuestTableScope,
  requireMemberCaller,
  resolveAuthCaller,
} from '@/lib/server/auth-caller'
import {
  createSelfPlayer,
  exchangeTableQr,
  getTableContext,
  linkSelfToPlayer,
  mutateTable,
  requestQrEnrollment,
} from '@/lib/server/table-checkin'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const caller = await resolveAuthCaller(request)
    const body = await jsonObject(request)
    const action = String(body.action ?? '')
    const result = await withTransaction(async (db) => {
      if (action === 'exchange') {
        const member = requireMemberCaller(caller)
        return exchangeTableQr(
          db,
          member,
          String(body.publicId ?? ''),
          String(body.signature ?? ''),
        )
      }
      if (action === 'requestEnrollment') {
        const member = requireMemberCaller(caller)
        return requestQrEnrollment(
          db,
          member,
          String(body.publicId ?? ''),
          String(body.signature ?? ''),
        )
      }
      const clubId = String(body.clubId ?? '')
        .trim()
        .toUpperCase()
      if (action === 'context')
        return getTableContext(db, caller, clubId, Number(body.tableNumber))
      if (action === 'linkSelf') {
        const member = requireMemberCaller(caller)
        return linkSelfToPlayer(db, member, clubId, String(body.playerId ?? ''))
      }
      if (action === 'createSelf') {
        const member = requireMemberCaller(caller)
        return createSelfPlayer(
          db,
          member,
          clubId,
          String(body.displayName ?? ''),
          String(body.icon ?? ''),
        )
      }
      if (['checkIn', 'seat', 'remove', 'clear', 'clearAll'].includes(action)) {
        if (caller.kind === 'guest') {
          assertGuestTableScope(caller, clubId, Number(body.tableNumber))
          if (!['seat', 'remove', 'clear'].includes(action))
            throw new Error('Guests can only seat players, remove players, or clear this table.')
        }
        return mutateTable(db, caller, {
          action: action as
            | 'checkIn'
            | 'seat'
            | 'remove'
            | 'clear'
            | 'clearAll',
          clubId,
          tableNumber: Number(body.tableNumber),
          playerId: body.playerId ? String(body.playerId) : undefined,
          replacePlayerId: body.replacePlayerId
            ? String(body.replacePlayerId)
            : undefined,
        })
      }
      throw new Error('Unsupported table action.')
    })
    return NextResponse.json({ result })
  } catch (error) {
    return apiError(error, 'Unable to update this table.')
  }
}
