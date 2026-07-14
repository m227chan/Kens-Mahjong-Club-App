import { createHash, randomBytes } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { adminAuth } from '@/lib/firebase-admin'
import { withTransaction } from '@/lib/postgres-admin'
import { mutateSupabaseGames } from '@/lib/server/supabase-game-management'

export const runtime = 'nodejs'
export const maxDuration = 60
const clubId = () => Array.from({ length: 6 }, () => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 32)]).join('')
const rowId = () => randomBytes(10).toString('hex')
const grantId = (club: string, email: string) => createHash('sha256').update(`${club}:${email}`).digest('hex')

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
    if (!token) return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
    const caller = await adminAuth.verifyIdToken(token)
    const body = await request.json() as Record<string, any>
    const action = String(body.action ?? '')
    if (['createGame', 'deleteGameAndRebuild', 'importGames', 'mutateGame'].includes(action)) {
      const input = action === 'createGame'
        ? { callerUid: caller.uid, clubId: body.clubId, action: 'create' as const, game: body.input }
        : action === 'deleteGameAndRebuild'
          ? { callerUid: caller.uid, clubId: body.clubId, action: 'delete' as const, gameId: body.gameId }
          : action === 'importGames'
            ? { callerUid: caller.uid, clubId: body.clubId, action: 'import' as const, games: body.input?.games }
            : { callerUid: caller.uid, clubId: body.mutation?.clubId, action: body.mutation?.action as 'update' | 'delete' | 'rebuild', gameId: body.mutation?.gameId, game: body.mutation?.game }
      const result = await mutateSupabaseGames(input)
      return NextResponse.json({ result: action === 'createGame' ? result.gameId : undefined })
    }
    const result = await withTransaction(async (db) => {
      const requireManager = async (club: string) => {
        const member = await db.query("select 1 from club_members where club_id=$1 and firebase_uid=$2 and active and role='manager'", [club, caller.uid])
        if (!member.rowCount) throw new Error('Only an active club manager can do that.')
      }
      const requireMember = async (club: string) => {
        const member = await db.query('select 1 from club_members where club_id=$1 and firebase_uid=$2 and active', [club, caller.uid])
        if (!member.rowCount) throw new Error('Only an active club member can do that.')
      }
      if (action === 'createClub') {
        const name = String(body.name ?? '').trim(); if (!name) throw new Error('Enter a club name.')
        let id = clubId(); while ((await db.query('select 1 from clubs where id=$1', [id])).rowCount) id = clubId()
        await db.query('insert into clubs(id,name,manager_uid,manager_email,manager_display_name) values($1,$2,$3,$4,$5)', [id,name,caller.uid,caller.email ?? null,caller.name ?? null])
        await db.query("insert into club_members(club_id,firebase_uid,email,display_name,photo_url,role) values($1,$2,$3,$4,$5,'manager')", [id,caller.uid,caller.email ?? null,caller.name ?? null,caller.picture ?? null])
        await db.query("insert into seasons(club_id,season_number,name,created_by) values($1,1,'Season 1',$2)", [id,caller.uid]); return id
      }
      if (action === 'requestToJoinClub') {
        const id = String(body.clubId ?? '').trim().toUpperCase(), user = body.user ?? {}
        if (!(await db.query('select 1 from clubs where id=$1 and active', [id])).rowCount) throw new Error('No club found with that ID.')
        if ((await db.query('select 1 from club_members where club_id=$1 and firebase_uid=$2 and active', [id,caller.uid])).rowCount) return 'already-member'
        await db.query(`insert into join_requests(club_id,firebase_uid,email,display_name,photo_url,status) values($1,$2,$3,$4,$5,'pending')
          on conflict(club_id,firebase_uid) do update set email=excluded.email,display_name=excluded.display_name,photo_url=excluded.photo_url,status='pending',created_at=now(),resolved_at=null,resolved_by=null`, [id,caller.uid,user.email ?? caller.email ?? null,user.displayName ?? caller.name ?? null,user.photoURL ?? caller.picture ?? null]); return 'requested'
      }
      if (action === 'resolveJoinRequest') {
        await requireManager(body.clubId); const req = body.request
        await db.query("update join_requests set status=$1,resolved_at=now(),resolved_by=$2 where club_id=$3 and firebase_uid=$4", [body.approved ? 'approved' : 'declined',caller.uid,body.clubId,req.uid])
        if (body.approved) await db.query(`insert into club_members(club_id,firebase_uid,email,display_name,photo_url,role,active) values($1,$2,$3,$4,$5,'member',true)
          on conflict(club_id,firebase_uid) do update set email=excluded.email,display_name=excluded.display_name,photo_url=excluded.photo_url,active=true`, [body.clubId,req.uid,req.email,req.displayName,req.photoURL ?? null]); return null
      }
      if (action === 'leaveClub') {
        if (body.clubId === 'KEN') throw new Error("Kendall's Mahjong Club is available to every user and cannot be left.")
        const member = await db.query('select role from club_members where club_id=$1 and firebase_uid=$2 and active', [body.clubId,caller.uid]); if (member.rows[0]?.role === 'manager') throw new Error('Club managers cannot leave their club yet.')
        await db.query('update club_members set active=false where club_id=$1 and firebase_uid=$2', [body.clubId,caller.uid]); return null
      }
      if (action === 'promoteManagerByEmail') {
        await requireManager(body.clubId); const email = String(body.email ?? '').trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')
        const club = (await db.query('select name,universal from clubs where id=$1', [body.clubId])).rows[0]
        try { const target = await adminAuth.getUserByEmail(email); await db.query(`insert into club_members(club_id,firebase_uid,email,display_name,photo_url,role,active,universal) values($1,$2,$3,$4,$5,'manager',true,$6)
          on conflict(club_id,firebase_uid) do update set role='manager',active=true,email=excluded.email,display_name=excluded.display_name,photo_url=excluded.photo_url`, [body.clubId,target.uid,target.email ?? null,target.displayName ?? null,target.photoURL ?? null,club.universal]); return { status: 'promoted', email }
        } catch (error) { if ((error as { code?: string }).code !== 'auth/user-not-found') throw error; await db.query(`insert into pending_manager_grants(id,club_id,club_name,email_normalized,status,requested_by) values($1,$2,$3,$4,'pending',$5)
          on conflict(id) do update set status='pending',requested_at=now(),requested_by=excluded.requested_by`, [grantId(body.clubId,email),body.clubId,club.name,email,caller.uid]); return { status: 'pending', email } }
      }
      if (action === 'createPlayer') {
        await requireManager(body.clubId); const input = body.input ?? {}, name = String(input.displayName ?? '').trim(); if (!name) throw new Error('Enter a player name.')
        const icon = String(input.icon ?? name[0] ?? '🀄').trim().slice(0,12), key = encodeURIComponent(icon.toLocaleLowerCase()), id = rowId()
        try { await db.query("insert into players(id,club_id,display_name,title,icon,icon_key,auth_uid) values($1,$2,$3,'Monk',$4,$5,$6)", [id,body.clubId,name,icon,key,input.authUid ?? null]) } catch (error) { if ((error as { code?: string }).code === '23505') throw new Error('That emoji is already in use in this club.'); throw error } return id
      }
      if (action === 'removePlayer') { await requireManager(body.clubId); await db.query('update players set active=false where id=$1 and club_id=$2', [body.playerId,body.clubId]); return null }
      if (action === 'setPlayerAuthLink') {
        const player = (await db.query('select auth_uid from players where id=$1 and club_id=$2 and active', [body.playerId,body.clubId])).rows[0]; if (!player) throw new Error('Player not found.')
        if (!body.linked && player.auth_uid !== caller.uid) throw new Error('You can only unlink your own player profile.')
        if (body.linked) { if (body.uid !== caller.uid) throw new Error('You can only link your own account.'); if (player.auth_uid && player.auth_uid !== caller.uid) throw new Error('That player is already linked to another user.'); if ((await db.query('select 1 from players where club_id=$1 and auth_uid=$2 and active and id<>$3', [body.clubId,caller.uid,body.playerId])).rowCount) throw new Error('Your account is already linked to another player in this club.') }
        await db.query('update players set auth_uid=$1 where id=$2 and club_id=$3', [body.linked ? caller.uid : null,body.playerId,body.clubId]); return null
      }
      if (action === 'updatePlayerIcon') { await requireManager(body.clubId); const icon=String(body.nextIcon ?? '').trim().slice(0,12); if (!icon) throw new Error('Enter an emoji.'); try { await db.query('update players set icon=$1,icon_key=$2 where id=$3 and club_id=$4', [icon,encodeURIComponent(icon.toLocaleLowerCase()),body.playerId,body.clubId]) } catch (error) { if ((error as { code?: string }).code === '23505') throw new Error('That emoji is already in use in this club.'); throw error } return null }
      if (action === 'updatePlayerName') { await requireManager(body.clubId); const name=String(body.nextName ?? '').trim().slice(0,80); if (!name) throw new Error('Enter a player name.'); await db.query('update players set display_name=$1 where id=$2 and club_id=$3 and active', [name,body.playerId,body.clubId]); return null }
      if (action === 'deleteClub') { await requireManager(body.clubId); if (body.clubId === 'KEN') throw new Error("Kendall's Mahjong Club cannot be deleted."); await db.query('update clubs set active=false,deleted_at=now(),deleted_by=$1 where id=$2', [caller.uid,body.clubId]); await db.query('update club_members set active=false where club_id=$1', [body.clubId]); return null }
      if (action === 'ensureSeasons') { await db.query("insert into seasons(club_id,season_number,name,created_by) values($1,1,'Season 1',$2) on conflict do nothing", [body.clubId,body.userId]); return null }
      if (action === 'startNewSeason') { await requireManager(body.clubId); await db.query('select pg_advisory_xact_lock(hashtext($1))', [`session:${body.clubId}`]); const next = Number((await db.query('select coalesce(max(season_number),0)+1 next from seasons where club_id=$1', [body.clubId])).rows[0].next); await db.query('update sessions set is_active=false,closed_at=coalesce(closed_at,now()) where club_id=$1 and is_active', [body.clubId]); await db.query('update seasons set active=false where club_id=$1', [body.clubId]); await db.query('insert into seasons(club_id,season_number,name,created_by) values($1,$2,$3,$4)', [body.clubId,next,`Season ${next}`,caller.uid]); await db.query('update clubs set active_season_number=$1 where id=$2', [next,body.clubId]); return next }
      if (action === 'setActiveSeason') { await requireManager(body.clubId); await db.query('update clubs set active_season_number=$1 where id=$2', [body.seasonNumber,body.clubId]); return null }
      if (action === 'createSession') {
        await requireMember(body.clubId)
        const input = body.input ?? {}, participants = Array.isArray(input.participants) ? input.participants.map(String) : []
        const tableCount = Math.min(99, Math.max(1, Math.floor(Number(input.tableCount) || 1))), seasonNumber = Math.floor(Number(input.seasonNumber) || 0)
        if (participants.length < 4) throw new Error('Select at least 4 players.')
        if (new Set(participants).size !== participants.length) throw new Error('A player can only be selected once per session.')
        if (!seasonNumber || !(await db.query('select 1 from seasons where club_id=$1 and season_number=$2', [body.clubId,seasonNumber])).rowCount) throw new Error('That season no longer exists. Refresh the app and try again.')
        const validPlayers = await db.query('select id from players where club_id=$1 and active and id=any($2::text[])', [body.clubId,participants])
        if (validPlayers.rowCount !== new Set(participants).size) throw new Error('One or more selected players are no longer on the roster. Refresh and try again.')
        await db.query('select pg_advisory_xact_lock(hashtext($1))', [`session:${body.clubId}`])
        const existing = (await db.query('select id,season_number from sessions where club_id=$1 and is_active for update', [body.clubId])).rows[0]
        const tables = input.tables && typeof input.tables === 'object' ? input.tables : {}, sideline = Array.isArray(input.sideline) ? input.sideline.map(String) : participants
        if (existing?.season_number === seasonNumber) {
          await db.query('update sessions set table_count=$1,participants=$2,tables=$3,sideline=$4 where id=$5', [tableCount,participants,JSON.stringify(tables),sideline,existing.id])
          return String(existing.id)
        }
        if (existing) await db.query('update sessions set is_active=false,closed_at=coalesce(closed_at,now()) where id=$1', [existing.id])
        const created = await db.query('insert into sessions(club_id,created_by,season_number,table_count,participants,tables,sideline) values($1,$2,$3,$4,$5,$6,$7) returning id', [body.clubId,caller.uid,seasonNumber,tableCount,participants,JSON.stringify(tables),sideline])
        return String(created.rows[0].id)
      }
      if (action === 'saveTableArrangement') { const arrangement=body.arrangement,id=arrangement.id || rowId(); await db.query(`insert into table_arrangements(id,club_id,created_at,tables,sideline) values($1,$2,$3,$4,$5) on conflict(id) do update set tables=excluded.tables,sideline=excluded.sideline`, [id,body.clubId,arrangement.createdAt ? new Date(arrangement.createdAt.seconds*1000) : new Date(),JSON.stringify(arrangement.tables),arrangement.sideline]); return id }
      if (action === 'ensureConfig') { await db.query(`insert into app_configs(club_id,title_bands,elo_base_k,elo_veteran_games_threshold,elo_starting_rating,elo_new_player_k,elo_intermediate_k,elo_new_player_games_threshold) values($1,$2,16,50,1500,32,24,20) on conflict do nothing`, [body.clubId,JSON.stringify([{minPoints:3000,maxPoints:99999,title:'Messiah'},{minPoints:1800,maxPoints:2999,title:'Master'},{minPoints:350,maxPoints:1799,title:'Musketeer'},{minPoints:150,maxPoints:349,title:'Marshal'},{minPoints:-650,maxPoints:149,title:'Monk'},{minPoints:-700,maxPoints:-651,title:'Mortal'},{minPoints:-1150,maxPoints:-701,title:'Minion'},{minPoints:-1550,maxPoints:-1151,title:'Mongrel'},{minPoints:-99999,maxPoints:-1551,title:'Moron'}])]); return null }
      throw new Error(`Unsupported Supabase action: ${action}`)
    })
    return NextResponse.json({ result })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Database operation failed.'
    return NextResponse.json({ error: message }, { status: message.includes('Only an active') ? 403 : 400 })
  }
}
