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
  setTableWinds,
  advanceTableWinds,
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
      if (action === 'setTableWinds') {
        if (caller.kind === 'guest') {
          assertGuestTableScope(caller, clubId, Number(body.tableNumber))
        }
        return setTableWinds(db, caller, {
          clubId,
          tableNumber: Number(body.tableNumber),
          starterPlayerId: body.starterPlayerId
            ? String(body.starterPlayerId)
            : null,
          clear: Boolean(body.clear),
          reconcile: Boolean(body.reconcile),
          patch:
            body.patch && typeof body.patch === 'object'
              ? {
                  roundWind:
                    (body.patch as { roundWind?: unknown }).roundWind != null
                      ? String((body.patch as { roundWind?: unknown }).roundWind)
                      : undefined,
                  dealerPlayerId:
                    (body.patch as { dealerPlayerId?: unknown }).dealerPlayerId !=
                    null
                      ? String(
                          (body.patch as { dealerPlayerId?: unknown })
                            .dealerPlayerId,
                        )
                      : undefined,
                  handNumber:
                    (body.patch as { handNumber?: unknown }).handNumber != null
                      ? Number(
                          (body.patch as { handNumber?: unknown }).handNumber,
                        )
                      : undefined,
                }
              : null,
        })
      }
      if (action === 'advanceTableWinds') {
        if (caller.kind === 'guest') {
          assertGuestTableScope(caller, clubId, Number(body.tableNumber))
        }
        const outcome = String(body.outcome ?? '')
        if (!['self_draw', 'discard', 'draw'].includes(outcome)) {
          throw new Error('Choose a valid hand outcome before advancing winds.')
        }
        return advanceTableWinds(db, caller, {
          clubId,
          tableNumber: Number(body.tableNumber),
          outcome: outcome as 'self_draw' | 'discard' | 'draw',
          winnerPlayerId: body.winnerPlayerId
            ? String(body.winnerPlayerId)
            : null,
          mode: body.mode
            ? (String(body.mode) as
                | 'non_dealer_and_draw'
                | 'non_dealer_only'
                | 'always')
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
