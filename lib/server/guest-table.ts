import 'server-only'

import type { PoolClient } from 'pg'
import { signGuestTableToken } from '@/lib/guest-table-token'

function normalizeClubId(value: string) {
  return value.trim().toUpperCase()
}

export async function validateGuestClub(db: PoolClient, rawClubId: string) {
  const clubId = normalizeClubId(rawClubId)
  // Normal clubs are 6 chars; universal club KEN is 3.
  if (!/^[A-Z0-9]{3,6}$/.test(clubId))
    throw new Error('Enter a valid club code.')

  const club = (
    await db.query(
      `select c.id, c.name,
        (select s.table_count from sessions s where s.club_id=c.id and s.is_active limit 1) table_count
       from clubs c
       where c.id=$1 and c.active`,
      [clubId],
    )
  ).rows[0]

  if (!club) throw new Error('No club found with that ID.')

  const tableCount = Number(club.table_count ?? 0)
  const tables =
    Number.isFinite(tableCount) && tableCount > 0
      ? Array.from({ length: tableCount }, (_, index) => index + 1)
      : []

  return {
    clubId: String(club.id),
    clubName: String(club.name),
    tables,
  }
}

export async function enterGuestTable(
  db: PoolClient,
  rawClubId: string,
  rawTableNumber: number,
) {
  const validated = await validateGuestClub(db, rawClubId)
  const tableNumber = Math.min(99, Math.max(1, Math.floor(Number(rawTableNumber) || 0)))
  if (!validated.tables.includes(tableNumber)) {
    throw new Error(
      validated.tables.length === 0
        ? 'No tables available yet. Ask a club member to start a session first.'
        : 'Choose one of the tables that already exist for this session.',
    )
  }

  const token = signGuestTableToken({
    clubId: validated.clubId,
    tableNumber,
  })

  return {
    token,
    clubId: validated.clubId,
    clubName: validated.clubName,
    tableNumber,
  }
}
