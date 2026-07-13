# Supabase data backend

Supabase PostgreSQL is the only application-data backend. Firebase is retained only for Google Authentication and ID-token verification.

## Required environment variables

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `SUPABASE_DATABASE_URL`
- Firebase client variables used by Firebase Authentication
- `FIREBASE_SERVICE_ACCOUNT_JSON` for server-side Firebase token verification

## Schema updates

Run `npm run supabase:schema`. Applied migration filenames are recorded in `public.app_schema_migrations`.

Historical spreadsheet data is represented by immutable raw games plus authoritative rows in `stat_baselines`. New games are replayed on top of those baselines, so game edits and current statistics do not require a legacy database.
