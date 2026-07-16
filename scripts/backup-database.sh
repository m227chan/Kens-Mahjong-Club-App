#!/usr/bin/env bash
set -euo pipefail

: "${DATABASE_URL:?DATABASE_URL is required}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is required}"

output_dir="${1:-backups}"
timestamp="$(date -u +'%Y-%m-%dT%H-%M-%SZ')"
archive="${output_dir}/supabase-${timestamp}.dump"
encrypted="${archive}.age"

mkdir -p "$output_dir"

# Pin the client major version. Credentials stay in the container environment
# rather than appearing in the command line or workflow logs.
docker run --rm \
  -e DATABASE_URL \
  -v "${PWD}/${output_dir}:/backups" \
  postgres:17-alpine \
  sh -euc 'pg_dump "$DATABASE_URL" --format=custom --no-owner --no-privileges --schema=public --file="/backups/'"$(basename "$archive")"'" && pg_restore --list "/backups/'"$(basename "$archive")"'" >/dev/null'

age --recipient "$BACKUP_AGE_RECIPIENT" --output "$encrypted" "$archive"
sha256sum "$encrypted" > "${encrypted}.sha256"
rm -f "$archive"

echo "Created encrypted backup: $encrypted"
