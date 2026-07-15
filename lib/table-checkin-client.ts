'use client'

import { auth } from '@/lib/firebase'

export type TablePlayer = { id: string; displayName: string; icon: string; authUid: string | null }
export type TableSession = { id: string; seasonNumber: number; tableCount: number; participants: string[]; tables: Record<string, string[]>; sideline: string[]; revision: number }
export type TableContext = { clubId: string; clubName: string; seasonNumber: number; tableNumber: number; session: TableSession | null; players: TablePlayer[]; linkedPlayer: TablePlayer | null }
export type TableQr = { tableNumber: number; publicId: string; enabled: boolean; url: string; svg: string }

async function authenticatedPost<T>(path: string, body: Record<string, unknown>) {
  const token = await auth.currentUser?.getIdToken()
  if (!token) throw new Error('Sign in to continue.')
  const response = await fetch(path, { method: 'POST', headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' }, body: JSON.stringify(body) })
  const payload = await response.json() as { result?: T; error?: string }
  if (!response.ok) throw new Error(payload.error ?? 'The request failed.')
  return payload.result as T
}

export const tableAction = <T>(body: Record<string, unknown>) => authenticatedPost<T>('/api/table-checkin', body)
export const generateTableQr = (clubId: string, tableNumber: number) => authenticatedPost<TableQr[]>('/api/table-qr', { action: 'generate', clubId, tableNumber })
export const generateAllTableQrs = (clubId: string, tableCount?: number) => authenticatedPost<TableQr[]>('/api/table-qr', { action: 'generateAll', clubId, tableCount })
export const getQrEnrollmentSetting = (clubId: string) => authenticatedPost<{ autoEnroll: boolean }>('/api/table-qr', { action: 'getEnrollmentSetting', clubId })
export const setQrEnrollmentSetting = (clubId: string, autoEnroll: boolean) => authenticatedPost<{ autoEnroll: boolean }>('/api/table-qr', { action: 'setEnrollmentSetting', clubId, autoEnroll })
