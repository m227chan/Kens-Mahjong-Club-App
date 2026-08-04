import 'server-only'

import { NextRequest } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { ApiError, bearerToken } from '@/lib/server/api'
import {
  guestCallerSubject,
  isGuestTableToken,
  verifyGuestTableToken,
  type GuestTableClaims,
} from '@/lib/guest-table-token'

export type MemberCaller = {
  kind: 'member'
  uid: string
  email: string | null
  name: string | null
  picture: string | null
}

export type GuestCaller = {
  kind: 'guest'
  uid: string
  clubId: string
  tableNumber: number
  claims: GuestTableClaims
}

export type AuthCaller = MemberCaller | GuestCaller

export async function resolveAuthCaller(request: NextRequest): Promise<AuthCaller> {
  const token = bearerToken(request)
  if (isGuestTableToken(token)) {
    const claims = verifyGuestTableToken(token)
    return {
      kind: 'guest',
      uid: guestCallerSubject(claims),
      clubId: claims.clubId,
      tableNumber: claims.tableNumber,
      claims,
    }
  }
  const decoded = await adminAuth.verifyIdToken(token)
  return {
    kind: 'member',
    uid: decoded.uid,
    email: decoded.email ?? null,
    name: decoded.name ?? null,
    picture: decoded.picture ?? null,
  }
}

export function requireMemberCaller(caller: AuthCaller): MemberCaller {
  if (caller.kind !== 'member')
    throw new ApiError('Sign in with Google to continue.', 401)
  return caller
}

export function assertGuestTableScope(
  caller: GuestCaller,
  clubId: string,
  tableNumber: number,
) {
  const normalizedClub = clubId.trim().toUpperCase()
  const normalizedTable = Math.min(99, Math.max(1, Math.floor(tableNumber)))
  if (caller.clubId !== normalizedClub || caller.tableNumber !== normalizedTable) {
    throw new ApiError('Guest access is limited to one table.', 403)
  }
}
