const clean = (value) => {
  const trimmed = value?.trim()
  if (!trimmed) return ''
  const wrapped = (trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  return wrapped ? trimmed.slice(1, -1).trim() : trimmed
}

const required = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
  'NEXT_PUBLIC_APP_URL',
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  'FIREBASE_SERVICE_ACCOUNT_JSON'
]

const errors = required
  .filter((name) => !clean(process.env[name]))
  .map((name) => `${name} is missing or empty in Vercel Production`)

const apiKey = clean(process.env.NEXT_PUBLIC_FIREBASE_API_KEY)
if (apiKey && !/^AIza[0-9A-Za-z_-]{20,}$/.test(apiKey)) {
  errors.push('NEXT_PUBLIC_FIREBASE_API_KEY is not a valid Firebase Web API key (expected the apiKey from Firebase project settings)')
}

for (const name of ['NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SUPABASE_URL']) {
  const value = clean(process.env[name])
  if (!value) continue
  try {
    const url = new URL(value)
    if (url.protocol !== 'https:') errors.push(`${name} must use https://`)
  } catch {
    errors.push(`${name} must be a complete URL`)
  }
}

const databaseUrl = clean(process.env.APP_DATABASE_URL) || clean(process.env.SUPABASE_DATABASE_URL)
if (!databaseUrl) errors.push('APP_DATABASE_URL (or the temporary SUPABASE_DATABASE_URL fallback) is missing in Vercel Production')
else if (!/^postgres(?:ql)?:\/\//i.test(databaseUrl)) errors.push('APP_DATABASE_URL must be a PostgreSQL connection string')

const serviceAccount = clean(process.env.FIREBASE_SERVICE_ACCOUNT_JSON)
if (serviceAccount) {
  try {
    const parsed = JSON.parse(serviceAccount)
    if (!parsed.project_id || !parsed.client_email || !parsed.private_key) {
      errors.push('FIREBASE_SERVICE_ACCOUNT_JSON is missing project_id, client_email, or private_key')
    }
  } catch {
    errors.push('FIREBASE_SERVICE_ACCOUNT_JSON must be valid single-line JSON')
  }
}

if (errors.length) {
  console.error('Production environment validation failed:')
  errors.forEach((error) => console.error(`- ${error}`))
  process.exit(1)
}

console.log('Production environment variables are present and structurally valid.')
