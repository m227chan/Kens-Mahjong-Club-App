import 'server-only'
import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getAuth } from 'firebase-admin/auth'

function credential() {
  const json = process.env.FIREBASE_SERVICE_ACCOUNT_JSON
  return json ? cert(JSON.parse(json)) : applicationDefault()
}

const adminApp = getApps().length ? getApps()[0] : initializeApp({
  credential: credential(),
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
})

export const adminAuth = getAuth(adminApp)
