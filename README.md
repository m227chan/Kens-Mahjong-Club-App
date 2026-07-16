# Mahjong Club Score Tracker

A responsive web application for organizing Mahjong clubs, running live sessions, recording game results, and following player performance over time.

## Features

- Create and manage clubs and seasons, with a six-club creation allowance per account and unlimited existing-club memberships or manager roles
- Maintain manager-controlled player rosters with renaming, account linking, and customizable emoji avatars
- Arrange tables and manage players during live sessions with viewport-centered, mobile-friendly dialogs
- Record self-draws, discard wins, draws, and point totals
- Review and correct individual game records with session-player filtering and responsive card/table layouts
- Track standings, win rates, cumulative scores, and experience-aware Skill ratings
- Explore player and club analytics
- Import and export game data as CSV
- Use light and dark themes across desktop and mobile layouts
- Manage memberships and manager permissions
- Open a concise signed-in app guide or practice the complete workflow in a temporary, no-write guided tour

## Technology

- Next.js and React
- TypeScript
- Tailwind CSS
- Supabase PostgreSQL, Row Level Security, and Realtime
- Firebase Authentication for Google sign-in
- Firebase Admin for server-side identity verification

Application data is stored in Supabase. Firebase is used only for authentication.

## Local development

Requirements:

- Node.js 20.19 or newer
- A Supabase project
- A Firebase project with Google Authentication enabled

Copy `.env.example` to `.env.local` and provide the required environment variables. Never commit `.env.local`, database credentials, service-account credentials, or production data.

Install dependencies and apply the database schema:

```bash
npm install
npm run supabase:schema
```

Start the development server:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality checks

```bash
npm test -- --run
npm run lint
npm run security:scan
npm run build
```

## Database migrations

Versioned SQL migrations are stored in `supabase/migrations`. Apply pending migrations with:

```bash
npm run supabase:schema
```

Applied migration filenames are recorded by the schema runner so migrations are not repeated.

## Deployment

Pull requests run secret scanning, linting, unit tests, and a production build in GitHub Actions. Merges to `main` pass the same gates before an Actions-driven Vercel production deployment. Database migrations remain a separate, manually confirmed workflow that creates an encrypted backup before applying pending SQL.

Keep all server credentials server-only. Variables containing database connection strings or Firebase Admin credentials must never use the `NEXT_PUBLIC_` prefix.

Production backup, recovery, GitHub/Vercel setup, branch protection, and least-privilege database instructions are in [`docs/OPERATIONS.md`](docs/OPERATIONS.md).
