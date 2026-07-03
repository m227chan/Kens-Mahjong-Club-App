# Ken's Mahjong Club Score Tracker

## Overview

Ken's Mahjong Club Score Tracker is a Firebase-backed web app for running Mahjong clubs, recording sessions, and tracking player performance over time. Signed-in users can create clubs, request to join existing clubs, manage rosters, run table sessions, record game outcomes, and review club leaderboards and analytics.

The app distinguishes between users and players:

- A user is someone who signs in with Firebase Authentication.
- A player is a tracked person on a club roster.
- A user can link themselves to one player in a club, but clubs can also track players who do not have a signed-in account.

## Features

- Email and Google sign-in through Firebase Authentication.
- User homepage with personal stats across linked players in all joined clubs.
- Create clubs with unique shareable club IDs.
- Join clubs by club ID with manager approval.
- Club managers can accept or decline join requests.
- Users can belong to multiple clubs and leave clubs.
- Club pages for club-specific leaderboard, roster, sessions, score charts, ELO, and analytics.
- Roster modal for adding, reviewing, and removing players without crowding the club page.
- Unique player icons or initials within each club.
- Session manager for selecting players, seating tables, recording wins/draws, and tracking scores.
- Club leaderboard with points, ELO, games played, wins, losses, and win ratio.
- Analytics modal with dashboard charts, game range filters, ELO movement, and club insights.
- Firestore security rules and indexes for authenticated club data.
- Vitest coverage for scoring, player, and stats engine behavior.
- Migration script for importing old sheet exports.

## Tech Stack

- Next.js 14 App Router
- React 18
- TypeScript
- Tailwind CSS
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- Firebase Cloud Functions
- Recharts
- Vitest

## Getting Started

### Prerequisites

- Node.js 20 or newer
- npm
- A Firebase project
- Firebase CLI for deployment

### Firebase Setup

1. Create a Firebase project.
2. Enable Firebase Authentication.
3. Enable Email/Password sign-in.
4. Enable Google sign-in.
5. Enable Cloud Firestore.
6. Add your local dev URL, such as `localhost`, to the Firebase Authentication authorized domains if needed.

### Local Setup

1. Install dependencies:

```bash
npm install
```

2. Copy the example environment file:

```bash
copy .env.example .env.local
```

On PowerShell, use:

```powershell
Copy-Item .env.example .env.local
```

3. Fill in `.env.local` with your Firebase web app config.

4. Start the development server:

```bash
npm run dev
```

5. Open [http://localhost:3000](http://localhost:3000).

### Useful Commands

```bash
npm run dev
npm run build
npm run start
npm test
```

## Usage

1. Sign in with email or Google.
2. Use the homepage to review your personal stats across clubs.
3. Create a new club or request to join an existing club with its club ID.
4. Select a club from the homepage to open the club page.
5. Use the club header actions:
   - `Roster` opens the player roster modal.
   - `Analytics` opens dashboard charts and club analytics.
   - `Club ID` copies or displays the shareable club ID.
   - `Back to homepage` returns to the user homepage.
6. Add players from the roster modal. Icons and initials must be unique within the club.
7. Use the session manager to choose players, seat tables, and record games.
8. Review leaderboard, ELO, score charts, and analytics as games are recorded.

## Project Structure

```text
app/
  club/[clubId]/page.tsx   Club route and membership gate
  login/page.tsx           Sign-in screen
  page.tsx                 Signed-in user homepage
  layout.tsx               Root app layout
  globals.css              Global styles

components/
  AnalyticsPanel.tsx       Club analytics cards
  ClubWorkspace.tsx        Club page shell, modals, and layout
  DashboardContent.tsx     Club dashboard charts and filters
  Leaderboard.tsx          Club standings table
  SessionManager.tsx       Session seating and game recording
  ThemeToggle.tsx          Theme control

contexts/
  AuthContext.tsx          Firebase auth provider

functions/
  src/                     Firebase Cloud Functions

src/dataconnect-*/         Generated Firebase Data Connect clients

__tests__/
  *.test.ts                Unit tests for scoring and stats behavior

firestore.rules            Firestore security rules
firestore.indexes.json     Firestore indexes
firebase.json              Firebase hosting/functions config
next.config.mjs            Next.js config
```

## Deployment

### Firebase Hosting

1. Install the Firebase CLI:

```bash
npm install -g firebase-tools
```

2. Sign in:

```bash
firebase login
```

3. Confirm the Firebase project in `.firebaserc`.

4. Build the app:

```bash
npm run build
```

5. Deploy hosting, Firestore rules, and indexes:

```bash
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

Deploy functions separately when function code changes:

```bash
firebase deploy --only functions
```

### Notes

- `.next/` and `.next-dev/` are build artifacts and should not be committed.
- Keep `.env.local` private. Commit only safe examples such as `.env.example`.
- Firestore rules must be deployed before production users can access club data correctly.

## Contributing

1. Create a feature branch.
2. Keep changes focused and avoid committing generated build output.
3. Run tests:

```bash
npm test
```

4. Run a production build when changing app routes, Firebase access, or shared components:

```bash
npm run build
```

5. Update documentation when behavior, setup, or deployment steps change.
6. Open a pull request using the PR template.

## Migration

Use the migration script with a game CSV and leaderboard CSV export:

```bash
npx tsx scripts/migrate-from-sheet.ts path/to/games.csv path/to/leaderboard.csv
```

The migration refuses to run if the Firestore games collection already contains documents.
