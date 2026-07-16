import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const rules = [
  ['Google/Firebase API key', /AIza[0-9A-Za-z_-]{20,}/],
  ['Personal email address', /\b[0-9A-Z._%+-]+@(?:gmail|hotmail|outlook|yahoo)\.[A-Z]{2,}\b/i],
  ['Populated Firebase API key environment variable', /^NEXT_PUBLIC_FIREBASE_API_KEY[^\S\r\n]*=[^\S\r\n]*\S+/m],
  ['Private key material', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ['age private identity', /AGE-SECRET-KEY-1[0-9A-Z]+/],
  ['Service-account private key field', /["']private_key["']\s*:\s*["'][^"']+/],
  ['Credential-bearing PostgreSQL URL', /postgres(?:ql)?:\/\/[^\s:/]+:[^\s@]+@/i],
  ['Supabase secret key', /\bsb_secret_[0-9A-Za-z_-]+\b/],
  ['Assigned Supabase service-role token', /(?:SUPABASE_SERVICE_ROLE_KEY|service_role)\s*[=:]\s*[^\s]+/i]
]

const trackedFiles = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean)

const findings = []

for (const path of trackedFiles) {
  let content
  try {
    const buffer = readFileSync(path)
    if (buffer.includes(0)) continue
    content = buffer.toString('utf8')
  } catch {
    continue
  }

  for (const [label, pattern] of rules) {
    if (pattern.test(content)) findings.push(`${path}: ${label}`)
  }
}

if (findings.length) {
  console.error('Potential credentials found in tracked files:')
  findings.forEach((finding) => console.error(`- ${finding}`))
  console.error('Move credentials to an ignored local/deployment environment file before committing.')
  process.exit(1)
}

console.log(`No credential patterns found in ${trackedFiles.length} commit-eligible files.`)
