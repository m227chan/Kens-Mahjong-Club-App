import 'server-only'
import { adminAuth } from '@/lib/firebase-admin'
import { withTransaction } from '@/lib/postgres-admin'

const managers: Record<string, string> = { 'matthew.tc76@gmail.com': 'Matt', 'chankendall@gmail.com': 'Kendall', 'calvin.gh.yap@gmail.com': 'Calvin' }

export async function ensureSupabaseUniversalMembership(uid: string) {
  const user = await adminAuth.getUser(uid)
  const email = (user.email ?? '').trim().toLowerCase(), role = managers[email] ? 'manager' : 'member'
  const tokenRefreshRequired = user.customClaims?.role !== 'authenticated'
  if (tokenRefreshRequired) await adminAuth.setCustomUserClaims(uid, { ...(user.customClaims ?? {}), role: 'authenticated' })
  await withTransaction(async (db) => {
    await db.query(`insert into clubs(id,name,manager_uid,manager_email,manager_display_name,active_season_number,active,universal)
      values('KEN',$1,'universal','chankendall@gmail.com','Kendall',2,true,true) on conflict(id) do update set universal=true,active=true
      where clubs.universal is distinct from true or clubs.active is distinct from true`, ["Kendall's Mahjong Club"])
    await db.query("insert into seasons(club_id,season_number,name,created_by,active) values('KEN',2,'Season 2','historical-migration',true) on conflict do nothing")
    await db.query(`insert into user_profiles(firebase_uid,email,display_name,photo_url) values($1,$2,$3,$4)
      on conflict(firebase_uid) do update set email=excluded.email,display_name=excluded.display_name,photo_url=excluded.photo_url,updated_at=now()
      where (user_profiles.email,user_profiles.display_name,user_profiles.photo_url) is distinct from (excluded.email,excluded.display_name,excluded.photo_url)`, [uid,user.email ?? null,user.displayName ?? null,user.photoURL ?? null])
    await db.query(`insert into club_members(club_id,firebase_uid,email,display_name,photo_url,role,active,universal) values('KEN',$1,$2,$3,$4,$5,true,true)
      on conflict(club_id,firebase_uid) do update set email=excluded.email,display_name=excluded.display_name,photo_url=excluded.photo_url,role=excluded.role,active=true,universal=true
      where (club_members.email,club_members.display_name,club_members.photo_url,club_members.role,club_members.active,club_members.universal)
        is distinct from (excluded.email,excluded.display_name,excluded.photo_url,excluded.role,true,true)`, [uid,user.email ?? null,user.displayName ?? null,user.photoURL ?? null,role])
    if (email) {
      const grants = await db.query("select * from pending_manager_grants where email_normalized=$1 and status='pending'", [email])
      for (const grant of grants.rows) {
        await db.query(`insert into club_members(club_id,firebase_uid,email,display_name,photo_url,role,active) values($1,$2,$3,$4,$5,'manager',true)
          on conflict(club_id,firebase_uid) do update set role='manager',active=true,email=excluded.email,display_name=excluded.display_name,photo_url=excluded.photo_url`, [grant.club_id,uid,user.email ?? null,user.displayName ?? null,user.photoURL ?? null])
        await db.query("update pending_manager_grants set status='applied',applied_at=now(),applied_to_uid=$1 where id=$2", [uid,grant.id])
      }
      if (managers[email]) await db.query('update players set auth_uid=$1 where club_id=\'KEN\' and lower(display_name)=lower($2) and auth_uid is distinct from $1', [uid,managers[email]])
    }
  })
  return { clubId: 'KEN', role, tokenRefreshRequired }
}
