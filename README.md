# Ken's Mahjong Club Score Tracker

A mobile-first Mahjong club app rebuilt around Firebase Auth, Firestore, and a shared ELO engine.

## What changed

- Firebase-backed leaderboard and player records
- Auth-required game entry and player creation
- Shared ELO and title-band logic in one stats module
- Dashboard, analytics, and seat-arrangement views
- Migration script for importing the old sheet export

## Local setup

1. Create a Firebase project.
2. Enable Authentication with Google sign-in and Firestore.
3. Copy [.env.example](.env.example) to .env.local and fill in your Firebase config values.
4. Install dependencies:

```bash
npm install
```

5. Start the app:

```bash
npm run dev
```

## Deploy

- Install the Firebase CLI.
- Run `firebase login`.
- Replace the project ID in [.firebaserc](.firebaserc).
- Deploy hosting, rules, and indexes:

```bash
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

## Migration

Use the script with a game CSV and leaderboard CSV export:

```bash
npx tsx scripts/migrate-from-sheet.ts path/to/games.csv path/to/leaderboard.csv
```

The migration refuses to run if the Firestore games collection already contains documents.
