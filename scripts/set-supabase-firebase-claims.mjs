import { cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

if (!process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  throw new Error('Missing FIREBASE_SERVICE_ACCOUNT_JSON in .env.local.')
}

const credential = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
const app = getApps().length ? getApps()[0] : initializeApp({ credential: cert(credential) })
const auth = getAuth(app)
let pageToken
let changed = 0
let unchanged = 0

do {
  const page = await auth.listUsers(1000, pageToken)
  for (const user of page.users) {
    if (user.customClaims?.role === 'authenticated') {
      unchanged += 1
      continue
    }
    await auth.setCustomUserClaims(user.uid, {
      ...(user.customClaims ?? {}),
      role: 'authenticated'
    })
    changed += 1
  }
  pageToken = page.pageToken
} while (pageToken)

console.log(`Firebase claims ready: ${changed} updated, ${unchanged} already configured.`)
