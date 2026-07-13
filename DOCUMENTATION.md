# Application documentation

## Runtime responsibilities

- `lib/supabase-data.ts` provides browser reads, Realtime subscriptions, caching, and server-action calls.
- `app/api/supabase-data/route.ts` verifies Firebase ID tokens and performs privileged club operations in PostgreSQL transactions.
- `lib/server/supabase-game-management.ts` creates, edits, deletes, imports, and rebuilds games and statistics.
- `lib/server/supabase-club-management.ts` enrolls authenticated users in the universal club and applies manager grants.
- `lib/firebase.ts` and `lib/firebase-admin.ts` are authentication-only modules.

## Historical baseline behavior

Imported games are stored normally in `games` and `game_entries` with `is_historical=true`. The authoritative aggregate values are stored in `stat_baselines`. A live stats rebuild starts at the baseline and replays only non-historical games. Editing or deleting an imported score adjusts the appropriate baseline before the live replay.

For universal club Season 2, points cover the complete historical source, while games played, wins, losses, attendance, and related metrics use the April 25, 2026 schema cutoff. Later seasons use normal application tracking for every metric.

## Authentication and authorization

Firebase Auth issues Google sign-in tokens. Supabase accepts those JWTs for Row Level Security, and server routes verify the same tokens with Firebase Admin. Club roles and memberships are stored in Supabase.

## Database changes

Add ordered SQL files under `supabase/migrations`, then run:

```bash
npm run supabase:schema
```

The runner records applied filenames in `public.app_schema_migrations`.
