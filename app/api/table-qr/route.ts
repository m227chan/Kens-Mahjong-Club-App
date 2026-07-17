import QRCode from 'qrcode'
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { withTransaction } from '@/lib/postgres-admin'
import { tableQrUrl } from '@/lib/qr-signing'
import { apiError, bearerToken, jsonObject } from '@/lib/server/api'
import { requireTableManager } from '@/lib/server/table-checkin'

export const runtime = 'nodejs'

async function qrView(origin: string, row: Record<string, unknown>) {
  const identity = {
    clubId: String(row.club_id),
    tableNumber: Number(row.table_number),
    tokenVersion: Number(row.token_version),
    publicId: String(row.public_id),
  }
  const url = tableQrUrl(origin, identity)
  const svg = await QRCode.toString(url, {
    type: 'svg',
    errorCorrectionLevel: 'Q',
    margin: 4,
    color: { dark: '#000000', light: '#ffffff' },
  })
  return {
    tableNumber: identity.tableNumber,
    publicId: identity.publicId,
    enabled: Boolean(row.enabled),
    url,
    svg,
  }
}

export async function POST(request: NextRequest) {
  try {
    const caller = await adminAuth.verifyIdToken(bearerToken(request))
    const body = await jsonObject(request)
    const clubId = String(body.clubId ?? '')
      .trim()
      .toUpperCase()
    const action = String(body.action ?? 'generate')
    if (
      ![
        'generate',
        'generateAll',
        'rotate',
        'getEnrollmentSetting',
        'setEnrollmentSetting',
      ].includes(action)
    ) {
      throw new Error('Unsupported QR action.')
    }
    if (
      action === 'getEnrollmentSetting' ||
      action === 'setEnrollmentSetting'
    ) {
      const setting = await withTransaction(async (db) => {
        await requireTableManager(db, clubId, caller.uid)
        if (action === 'setEnrollmentSetting') {
          await db.query(
            'update clubs set qr_auto_enroll=$1 where id=$2 and active',
            [body.autoEnroll === true, clubId],
          )
        }
        const club = (
          await db.query(
            'select qr_auto_enroll from clubs where id=$1 and active',
            [clubId],
          )
        ).rows[0]
        if (!club) throw new Error('Club not found.')
        return { autoEnroll: Boolean(club.qr_auto_enroll) }
      })
      return NextResponse.json({ result: setting })
    }
    const rows = await withTransaction(async (db) => {
      const membership = await db.query(
        'select role from club_members where club_id=$1 and firebase_uid=$2 and active',
        [clubId, caller.uid],
      )
      if (!membership.rowCount)
        throw new Error('You are not an active member of this club.')
      if (action === 'rotate') await requireTableManager(db, clubId, caller.uid)
      let tableNumbers: number[] = []
      if (action === 'generateAll') {
        const active = (
          await db.query(
            'select table_count from sessions where club_id=$1 and is_active order by created_at desc limit 1',
            [clubId],
          )
        ).rows[0]
        const count = Math.min(
          99,
          Math.max(1, Number(active?.table_count ?? body.tableCount ?? 1)),
        )
        tableNumbers = Array.from({ length: count }, (_, index) => index + 1)
      } else {
        tableNumbers = [
          Math.min(99, Math.max(1, Math.floor(Number(body.tableNumber) || 1))),
        ]
      }
      await db.query(
        `insert into club_qr_tables(club_id,table_number,label)
         select $1,number,'Table ' || number from unnest($2::int[]) number
         on conflict(club_id,table_number) do update set enabled=true,updated_at=now()`,
        [clubId, tableNumbers],
      )
      if (action === 'rotate')
        await db.query(
          'update club_qr_tables set token_version=token_version+1,updated_at=now() where club_id=$1 and table_number=$2',
          [clubId, tableNumbers[0]],
        )
      return (
        await db.query(
          'select * from club_qr_tables where club_id=$1 and table_number=any($2::int[]) order by table_number',
          [clubId, tableNumbers],
        )
      ).rows
    })
    return NextResponse.json({
      result: await Promise.all(
        rows.map((row) => qrView(request.nextUrl.origin, row)),
      ),
    })
  } catch (error) {
    return apiError(error, 'Unable to generate table QR codes.')
  }
}
