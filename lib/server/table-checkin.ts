import 'server-only'

import { randomBytes } from 'node:crypto'
import type { PoolClient } from 'pg'
import { normalizeSessionLayout } from '@/lib/session-layout'
import { verifyTableQr } from '@/lib/qr-signing'

type Caller = { uid: string; email?: string | null; name?: string | null; picture?: string | null }
type SessionRow = Record<string, unknown>
type MutationAction = 'checkIn' | 'seat' | 'remove' | 'clear' | 'clearAll'

const rowId = () => randomBytes(10).toString('hex')

function sessionPayload(row: SessionRow | undefined) {
  if (!row) return null
  const participants = (row.participants as string[]) ?? []
  const tableCount = Number(row.table_count)
  const normalized = normalizeSessionLayout(participants, tableCount, (row.tables as Record<string, string[]>) ?? {}, (row.sideline as string[]) ?? [])
  return {
    id: String(row.id),
    seasonNumber: Number(row.season_number),
    tableCount,
    participants,
    tables: normalized.tables,
    sideline: normalized.sideline,
    revision: Number(row.revision ?? 0)
  }
}

async function requireMember(db: PoolClient, clubId: string, uid: string) {
  const member = await db.query('select role from club_members where club_id=$1 and firebase_uid=$2 and active', [clubId, uid])
  if (!member.rowCount) throw new Error('You are not an active member of this club.')
  return String(member.rows[0].role)
}

export async function requireTableManager(db: PoolClient, clubId: string, uid: string) {
  const role = await requireMember(db, clubId, uid)
  if (role !== 'manager') throw new Error('Only a club manager can change QR settings.')
}

export async function clearStaleTables(db: PoolClient) {
  await db.query('select public.clear_stale_session_tables()')
}

async function roster(db: PoolClient, clubId: string) {
  const rows = await db.query('select id,display_name,icon,auth_uid from players where club_id=$1 and active order by display_name', [clubId])
  return rows.rows.map((row) => ({ id: String(row.id), displayName: String(row.display_name), icon: String(row.icon), authUid: row.auth_uid ? String(row.auth_uid) : null }))
}

export async function exchangeTableQr(db: PoolClient, caller: Caller, publicId: string, signature: string) {
  const qrResult = await db.query(`select q.*,c.name club_name,c.universal,c.qr_auto_enroll from club_qr_tables q join clubs c on c.id=q.club_id
    where q.public_id=$1 and q.enabled and c.active for update of q`, [publicId])
  const qr = qrResult.rows[0]
  if (!qr || !verifyTableQr({ clubId: qr.club_id, tableNumber: Number(qr.table_number), tokenVersion: Number(qr.token_version), publicId: qr.public_id }, signature)) {
    throw new Error('This table code is no longer active. Ask the club manager for the current QR code.')
  }
  const existingMember = await db.query('select 1 from club_members where club_id=$1 and firebase_uid=$2 and active', [qr.club_id, caller.uid])
  if (!existingMember.rowCount && !qr.qr_auto_enroll) {
    const request = (await db.query('select status from join_requests where club_id=$1 and firebase_uid=$2', [qr.club_id, caller.uid])).rows[0]
    return {
      clubId: String(qr.club_id),
      clubName: String(qr.club_name),
      tableNumber: Number(qr.table_number),
      enrollmentStatus: request?.status === 'pending' ? 'pending' as const : 'required' as const,
      linkedPlayer: null,
      players: [],
      unlinkedPlayers: []
    }
  }
  await db.query(`insert into club_members(club_id,firebase_uid,email,display_name,photo_url,role,active,universal)
    values($1,$2,$3,$4,$5,'member',true,$6)
    on conflict(club_id,firebase_uid) do update set email=excluded.email,display_name=excluded.display_name,photo_url=excluded.photo_url,active=true,
      role=club_members.role`, [qr.club_id, caller.uid, caller.email ?? null, caller.name ?? null, caller.picture ?? null, Boolean(qr.universal)])
  if (!existingMember.rowCount) {
    await db.query(`update join_requests set status='approved',resolved_at=now(),resolved_by='qr-auto-enrollment'
      where club_id=$1 and firebase_uid=$2 and status='pending'`, [qr.club_id, caller.uid])
  }
  const players = await roster(db, qr.club_id)
  const linked = players.find((player) => player.authUid === caller.uid) ?? null
  return {
    clubId: String(qr.club_id),
    clubName: String(qr.club_name),
    tableNumber: Number(qr.table_number),
    linkedPlayer: linked,
    players,
    unlinkedPlayers: linked ? [] : players.filter((player) => !player.authUid)
  }
}

export async function requestQrEnrollment(db: PoolClient, caller: Caller, publicId: string, signature: string) {
  const qr = (await db.query(`select q.*,c.name club_name,c.qr_auto_enroll from club_qr_tables q join clubs c on c.id=q.club_id
    where q.public_id=$1 and q.enabled and c.active for update of q`, [publicId])).rows[0]
  if (!qr || !verifyTableQr({ clubId: qr.club_id, tableNumber: Number(qr.table_number), tokenVersion: Number(qr.token_version), publicId: qr.public_id }, signature)) {
    throw new Error('This table code is no longer active. Ask the club manager for the current QR code.')
  }
  if ((await db.query('select 1 from club_members where club_id=$1 and firebase_uid=$2 and active', [qr.club_id, caller.uid])).rowCount) {
    return { clubId: String(qr.club_id), clubName: String(qr.club_name), tableNumber: Number(qr.table_number), enrollmentStatus: 'member' as const }
  }
  if (qr.qr_auto_enroll) {
    return { clubId: String(qr.club_id), clubName: String(qr.club_name), tableNumber: Number(qr.table_number), enrollmentStatus: 'retry' as const }
  }
  await db.query(`insert into join_requests(club_id,firebase_uid,email,display_name,photo_url,status)
    values($1,$2,$3,$4,$5,'pending') on conflict(club_id,firebase_uid) do update set
    email=excluded.email,display_name=excluded.display_name,photo_url=excluded.photo_url,status='pending',created_at=now(),resolved_at=null,resolved_by=null`,
    [qr.club_id, caller.uid, caller.email ?? null, caller.name ?? null, caller.picture ?? null])
  return { clubId: String(qr.club_id), clubName: String(qr.club_name), tableNumber: Number(qr.table_number), enrollmentStatus: 'pending' as const }
}

export async function getTableContext(db: PoolClient, caller: Caller, clubId: string, tableNumber: number) {
  await requireMember(db, clubId, caller.uid)
  await clearStaleTables(db)
  const club = (await db.query('select name,active_season_number from clubs where id=$1 and active', [clubId])).rows[0]
  if (!club) throw new Error('Club not found.')
  const active = (await db.query('select * from sessions where club_id=$1 and is_active order by created_at desc limit 1', [clubId])).rows[0]
  const players = await roster(db, clubId)
  return {
    clubId,
    clubName: String(club.name),
    seasonNumber: Number(club.active_season_number),
    tableNumber,
    session: sessionPayload(active),
    players,
    linkedPlayer: players.find((player) => player.authUid === caller.uid) ?? null
  }
}

export async function linkSelfToPlayer(db: PoolClient, caller: Caller, clubId: string, playerId: string) {
  await requireMember(db, clubId, caller.uid)
  await db.query('select pg_advisory_xact_lock(hashtext($1))', [`player-link:${clubId}:${caller.uid}`])
  if ((await db.query('select 1 from players where club_id=$1 and auth_uid=$2 and active', [clubId, caller.uid])).rowCount) throw new Error('Your account is already linked to a player in this club.')
  const updated = await db.query('update players set auth_uid=$1 where club_id=$2 and id=$3 and active and auth_uid is null returning id,display_name,icon', [caller.uid, clubId, playerId])
  if (!updated.rowCount) throw new Error('That player was linked by someone else. Choose another player.')
  return { id: String(updated.rows[0].id), displayName: String(updated.rows[0].display_name), icon: String(updated.rows[0].icon), authUid: caller.uid }
}

export async function createSelfPlayer(db: PoolClient, caller: Caller, clubId: string, displayName: string, icon: string) {
  await requireMember(db, clubId, caller.uid)
  await db.query('select pg_advisory_xact_lock(hashtext($1))', [`player-link:${clubId}:${caller.uid}`])
  if ((await db.query('select 1 from players where club_id=$1 and auth_uid=$2 and active', [clubId, caller.uid])).rowCount) throw new Error('Your account is already linked to a player in this club.')
  const name = displayName.trim().slice(0, 80)
  const chosenIcon = icon.trim().slice(0, 12) || '🀄'
  if (!name) throw new Error('Enter your player name.')
  const created = await db.query(`insert into players(id,club_id,display_name,title,icon,icon_key,auth_uid)
    values($1,$2,$3,'Monk',$4,$5,$6) returning id,display_name,icon`, [rowId(), clubId, name, encodeURIComponent(chosenIcon.toLocaleLowerCase()), caller.uid])
  return { id: String(created.rows[0].id), displayName: String(created.rows[0].display_name), icon: String(created.rows[0].icon), authUid: caller.uid }
}

function ensureTables(tableCount: number, rawTables: Record<string, string[]>) {
  return Object.fromEntries(Array.from({ length: tableCount }, (_, index) => {
    const key = String(index + 1)
    return [key, [...new Set(rawTables[key] ?? [])]]
  }))
}

async function markOccupied(db: PoolClient, sessionId: string, tableNumber: number, wasEmpty: boolean) {
  await db.query(`insert into session_table_activity(session_id,table_number,occupied_since,last_roster_change_at,cleared_at)
    values($1,$2,now(),now(),null)
    on conflict(session_id,table_number) do update set
      occupied_since=case when $3 then now() else coalesce(session_table_activity.occupied_since,now()) end,
      last_roster_change_at=now(),cleared_at=null`, [sessionId, tableNumber, wasEmpty])
}

async function markCleared(db: PoolClient, sessionId: string, tableNumber: number) {
  await db.query(`insert into session_table_activity(session_id,table_number,last_roster_change_at,cleared_at)
    values($1,$2,now(),now()) on conflict(session_id,table_number) do update
    set occupied_since=null,last_game_at=null,last_roster_change_at=now(),cleared_at=now()`, [sessionId, tableNumber])
}

export async function mutateTable(db: PoolClient, caller: Caller, input: { action: MutationAction; clubId: string; tableNumber?: number; playerId?: string; replacePlayerId?: string }) {
  const { clubId } = input
  await requireMember(db, clubId, caller.uid)
  await db.query('select pg_advisory_xact_lock(hashtext($1))', [`session:${clubId}`])
  await clearStaleTables(db)
  const club = (await db.query('select active_season_number from clubs where id=$1 and active', [clubId])).rows[0]
  if (!club) throw new Error('Club not found.')
  const seasonNumber = Number(club.active_season_number)
  let row = (await db.query('select * from sessions where club_id=$1 and is_active for update', [clubId])).rows[0]
  const targetTable = Math.max(1, Math.floor(Number(input.tableNumber) || 1))

  let playerId = input.playerId
  if (input.action === 'checkIn') {
    playerId = String((await db.query('select id from players where club_id=$1 and auth_uid=$2 and active', [clubId, caller.uid])).rows[0]?.id ?? '')
    if (!playerId) throw new Error('Link or create your roster player before checking in.')
  }

  if (!row && input.action !== 'checkIn') throw new Error('Start or join a session before changing this table.')
  if (!row) {
    const tables = ensureTables(targetTable, { [String(targetTable)]: [playerId!] })
    row = (await db.query(`insert into sessions(club_id,created_by,season_number,table_count,participants,tables,sideline,revision)
      values($1,$2,$3,$4,$5,$6,'{}',1) returning *`, [clubId, caller.uid, seasonNumber, targetTable, [playerId], JSON.stringify(tables)])).rows[0]
    await markOccupied(db, String(row.id), targetTable, true)
    return { status: 'ok' as const, session: sessionPayload(row) }
  }

  if (Number(row.season_number) !== seasonNumber && input.action === 'checkIn') {
    await db.query('update sessions set is_active=false,closed_at=coalesce(closed_at,now()) where id=$1', [row.id])
    const tables = ensureTables(targetTable, { [String(targetTable)]: [playerId!] })
    row = (await db.query(`insert into sessions(club_id,created_by,season_number,table_count,participants,tables,sideline,revision)
      values($1,$2,$3,$4,$5,$6,'{}',1) returning *`, [clubId, caller.uid, seasonNumber, targetTable, [playerId], JSON.stringify(tables)])).rows[0]
    await markOccupied(db, String(row.id), targetTable, true)
    return { status: 'ok' as const, session: sessionPayload(row) }
  }

  const nextCount = Math.max(Number(row.table_count), targetTable)
  const participants = [...new Set(((row.participants as string[]) ?? []).map(String))]
  const normalized = normalizeSessionLayout(participants, Number(row.table_count), (row.tables as Record<string, string[]>) ?? {}, (row.sideline as string[]) ?? [])
  const tables = ensureTables(nextCount, normalized.tables)
  let sideline = [...new Set(normalized.sideline)]

  if (input.action === 'clearAll') {
    for (const [key, occupants] of Object.entries(tables)) {
      sideline = [...new Set([...sideline, ...occupants])]
      tables[key] = []
      await markCleared(db, String(row.id), Number(key))
    }
  } else if (input.action === 'clear') {
    const key = String(targetTable)
    sideline = [...new Set([...sideline, ...(tables[key] ?? [])])]
    tables[key] = []
    await markCleared(db, String(row.id), targetTable)
  } else if (input.action === 'remove') {
    if (!playerId) throw new Error('Choose a player to remove.')
    const key = String(targetTable)
    tables[key] = (tables[key] ?? []).filter((id) => id !== playerId)
    sideline = [...new Set([...sideline, playerId])]
    if (tables[key].length === 0) await markCleared(db, String(row.id), targetTable)
  } else {
    if (!playerId) throw new Error('Choose a player.')
    if (!(await db.query('select 1 from players where club_id=$1 and id=$2 and active', [clubId, playerId])).rowCount) throw new Error('That roster player is unavailable.')
    const key = String(targetTable)
    const target = tables[key] ?? []
    const alreadyAtTarget = target.includes(playerId)
    if (!alreadyAtTarget && target.length >= 4) {
      if (!input.replacePlayerId || !target.includes(input.replacePlayerId)) return { status: 'table_full' as const, occupants: target, session: sessionPayload(row) }
      tables[key] = target.filter((id) => id !== input.replacePlayerId)
      sideline = [...new Set([...sideline, input.replacePlayerId])]
    }
    for (const tableKey of Object.keys(tables)) tables[tableKey] = tables[tableKey].filter((id) => id !== playerId)
    sideline = sideline.filter((id) => id !== playerId)
    const wasEmpty = tables[key].length === 0
    tables[key] = [...tables[key], playerId].slice(0, 4)
    if (!participants.includes(playerId)) participants.push(playerId)
    await markOccupied(db, String(row.id), targetTable, wasEmpty)
  }

  const updated = (await db.query(`update sessions set table_count=$1,participants=$2,tables=$3,sideline=$4,revision=revision+1
    where id=$5 returning *`, [nextCount, participants, JSON.stringify(tables), sideline, row.id])).rows[0]
  return { status: 'ok' as const, session: sessionPayload(updated) }
}
