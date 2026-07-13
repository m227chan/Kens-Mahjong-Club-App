# Ken's Mahjong Club Score Tracker

A responsive Mahjong club dashboard for managing rosters, live sessions, score records, standings, ELO ratings, analytics, seasons, and club membership.

## Architecture

- Next.js, React, TypeScript, and Tailwind CSS
- Supabase PostgreSQL, Row Level Security, and Realtime for all application data
- Firebase Authentication for Google sign-in only
- Server-side Firebase Admin token verification

The data layer is Supabase-only. See [docs/SUPABASE.md](docs/SUPABASE.md).

## Local development

1. Copy `.env.example` to `.env.local` and fill in the Firebase Auth and Supabase values.
2. Apply database migrations with `npm run supabase:schema`.
3. Install and run:

```bash
npm install
npm run dev
```

## Verification

```bash
npm test -- --run
npm run lint
npm run build
```

## Data model

Schema migrations live in `supabase/migrations`. The universal club's imported Season 2 data uses `stat_baselines` for authoritative spreadsheet totals and marks its source games as historical. New games are calculated on top of that baseline, preserving normal create, edit, delete, analytics, and ELO behavior without re-reading the source workbook.

## Deployment

Deploy the Next.js app to Vercel with the variables listed in `.env.example`. Apply new SQL migrations separately with `npm run supabase:schema`. Firebase deployment is not required for application data; its project is used only for Authentication.
