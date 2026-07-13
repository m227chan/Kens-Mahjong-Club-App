'use client'

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { auth } from '@/lib/firebase'

let browserClient: SupabaseClient | null = null

function cleanEnvironmentValue(value: string | undefined) {
  const trimmed = value?.trim()
  if (!trimmed) return ''
  const wrapped = (trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  return wrapped ? trimmed.slice(1, -1).trim() : trimmed
}

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient
  const url = cleanEnvironmentValue(process.env.NEXT_PUBLIC_SUPABASE_URL)
  const publishableKey = cleanEnvironmentValue(process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY)
  if (!url || !publishableKey) throw new Error('Supabase browser environment variables are not configured.')
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must be the HTTPS project URL from Supabase, without wrapping quotes.')
  }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL must start with https:// and must not be a PostgreSQL connection string.')
  }
  browserClient = createClient(url, publishableKey, {
    accessToken: async () => (await auth.currentUser?.getIdToken(false)) ?? null,
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
  return browserClient
}
