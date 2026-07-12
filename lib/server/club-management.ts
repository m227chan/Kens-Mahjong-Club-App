import 'server-only'
import { createHash } from 'node:crypto'
import type { UserRecord } from 'firebase-admin/auth'
import { FieldValue } from 'firebase-admin/firestore'
import { adminAuth, adminDb } from '@/lib/firebase-admin'

const KEN = 'KEN'
const KEN_NAME = "Kendall's Mahjong Club"
const KEN_MANAGERS: Record<string, string> = {
  'matthew.tc76@gmail.com': 'Matt',
  'chankendall@gmail.com': 'Kendall',
  'calvin.gh.yap@gmail.com': 'Calvin'
}
const pathOf = (...parts: string[]) => parts.join('/')
const cleanEmail = (value: string) => value.trim().toLowerCase()
const grantId = (clubId: string, email: string) => createHash('sha256').update(clubId + ':' + email).digest('hex')

function addMembership(
  batch: FirebaseFirestore.WriteBatch,
  clubId: string,
  clubName: string,
  user: Pick<UserRecord, 'uid' | 'email' | 'displayName' | 'photoURL'>,
  role: 'manager' | 'member',
  universal = false
) {
  const membership = {
    clubId,
    clubName,
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? null,
    photoURL: user.photoURL ?? null,
    role,
    joinedAt: FieldValue.serverTimestamp(),
    active: true,
    universal
  }
  batch.set(adminDb.doc(pathOf('clubs', clubId, 'members', user.uid)), membership, { merge: true })
  batch.set(adminDb.doc(pathOf('users', user.uid, 'clubs', clubId)), membership, { merge: true })
}

async function linkKenPlayer(email: string, uid: string) {
  const playerName = KEN_MANAGERS[email]
  if (!playerName) return
  const players = await adminDb.collection(pathOf('clubs', KEN, 'players')).where('displayName', '==', playerName).limit(1).get()
  if (!players.empty) await players.docs[0].ref.set({ authUid: uid }, { merge: true })
}

export async function ensureUniversalMembership(uid: string) {
  const user = await adminAuth.getUser(uid)
  const email = cleanEmail(user.email ?? '')
  const kenManager = Boolean(KEN_MANAGERS[email])
  const desiredRole = kenManager ? 'manager' : 'member'
  const clubRef = adminDb.doc(pathOf('clubs', KEN))
  const memberRef = adminDb.doc(pathOf('clubs', KEN, 'members', uid))
  const userClubRef = adminDb.doc(pathOf('users', uid, 'clubs', KEN))
  const pendingQuery = email
    ? adminDb.collection('pendingManagerGrants').where('emailNormalized', '==', email).where('status', '==', 'pending')
    : null
  const [club, member, userClub, pending] = await Promise.all([
    clubRef.get(), memberRef.get(), userClubRef.get(), pendingQuery?.get() ?? Promise.resolve(null)
  ])

  const membershipCurrent = club.exists
    && member.exists && member.get('active') === true && member.get('role') === desiredRole
    && userClub.exists && userClub.get('active') === true && userClub.get('role') === desiredRole
  if (membershipCurrent && (pending?.empty ?? true)) return { clubId: KEN, role: desiredRole }

  const batch = adminDb.batch()

  batch.set(clubRef, {
    id: KEN,
    name: KEN_NAME,
    managerUid: 'universal',
    managerEmail: 'chankendall@gmail.com',
    managerDisplayName: 'Kendall',
    ...(club.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    activeSeasonNumber: 2,
    active: true,
    universal: true
  }, { merge: true })
  batch.set(adminDb.doc(pathOf('clubs', KEN, 'seasons', '2')), {
    id: '2',
    seasonNumber: 2,
    name: 'Season 2',
    createdAt: FieldValue.serverTimestamp(),
    createdBy: 'historical-migration',
    active: true
  }, { merge: true })
  addMembership(batch, KEN, KEN_NAME, user, kenManager ? 'manager' : 'member', true)

  for (const grant of pending?.docs ?? []) {
    const data = grant.data()
    const club = await adminDb.doc(pathOf('clubs', data.clubId)).get()
    if (!club.exists) continue
    addMembership(batch, data.clubId, String(club.get('name') ?? data.clubName), user, 'manager', Boolean(club.get('universal')))
    batch.set(grant.ref, {
      status: 'applied',
      appliedAt: FieldValue.serverTimestamp(),
      appliedToUid: user.uid
    }, { merge: true })
  }
  await batch.commit()
  if (email) await linkKenPlayer(email, user.uid)
  return { clubId: KEN, role: desiredRole }
}

export async function promoteManager(callerUid: string, clubIdInput: string, emailInput: string) {
  const clubId = clubIdInput.trim().toUpperCase()
  const email = cleanEmail(emailInput)
  if (!clubId || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('Enter a valid email address.')

  const [club, caller] = await Promise.all([
    adminDb.doc(pathOf('clubs', clubId)).get(),
    adminDb.doc(pathOf('clubs', clubId, 'members', callerUid)).get()
  ])
  if (!club.exists) throw new Error('Club not found.')
  if (!caller.exists || caller.get('active') !== true || caller.get('role') !== 'manager') {
    throw new Error('Only an active club manager can promote managers.')
  }

  try {
    const target = await adminAuth.getUserByEmail(email)
    const batch = adminDb.batch()
    addMembership(batch, clubId, String(club.get('name')), target, 'manager', Boolean(club.get('universal')))
    batch.set(adminDb.doc(pathOf('pendingManagerGrants', grantId(clubId, email))), {
      clubId,
      clubName: club.get('name'),
      emailNormalized: email,
      status: 'applied',
      requestedBy: callerUid,
      requestedAt: FieldValue.serverTimestamp(),
      appliedAt: FieldValue.serverTimestamp(),
      appliedToUid: target.uid
    }, { merge: true })
    await batch.commit()
    if (clubId === KEN) await linkKenPlayer(email, target.uid)
    return { status: 'promoted' as const, email }
  } catch (error) {
    if ((error as { code?: string }).code !== 'auth/user-not-found') throw error
    await adminDb.doc(pathOf('pendingManagerGrants', grantId(clubId, email))).set({
      clubId,
      clubName: club.get('name'),
      emailNormalized: email,
      status: 'pending',
      requestedBy: callerUid,
      requestedAt: FieldValue.serverTimestamp()
    }, { merge: true })
    return { status: 'pending' as const, email }
  }
}
