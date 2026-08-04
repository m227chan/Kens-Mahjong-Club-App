'use client'

export type GuestTableSession = {
  token: string
  clubId: string
  clubName: string
  tableNumber: number
}

const STORAGE_KEY = 'mahjong:guest-table-session:v1'

export function readGuestTableSession(): GuestTableSession | null {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const value = JSON.parse(raw) as GuestTableSession
    if (
      !value?.token ||
      !value.clubId ||
      !Number.isFinite(value.tableNumber)
    ) {
      return null
    }
    return {
      token: String(value.token),
      clubId: String(value.clubId).trim().toUpperCase(),
      clubName: String(value.clubName ?? ''),
      tableNumber: Math.min(99, Math.max(1, Math.floor(Number(value.tableNumber)))),
    }
  } catch {
    return null
  }
}

export function writeGuestTableSession(session: GuestTableSession) {
  window.sessionStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      token: session.token,
      clubId: session.clubId.trim().toUpperCase(),
      clubName: session.clubName,
      tableNumber: Math.min(99, Math.max(1, Math.floor(session.tableNumber))),
    }),
  )
}

export function clearGuestTableSession() {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* private storage mode */
  }
}

/** End guest access and send the user to login so the table URL cannot be reused. */
export function exitGuestTableToLogin() {
  clearGuestTableSession()
  window.location.replace('/login')
}

export function guestSessionMatches(clubId: string, tableNumber: number) {
  const session = readGuestTableSession()
  if (!session) return false
  return (
    session.clubId === clubId.trim().toUpperCase() &&
    session.tableNumber === Math.min(99, Math.max(1, Math.floor(tableNumber)))
  )
}
