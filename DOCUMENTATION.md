# Ken's Mahjong Club Score Tracker

## Overview

Ken's Mahjong Club Score Tracker is a mobile-first web app built with Next.js, TypeScript, Tailwind CSS, Firebase Auth, Firestore, and a shared ELO scoring engine. It is designed to let club admins record Mahjong rounds, manage players, seat tables, and analyze player performance over time.

## Core Features

- Club dashboard with cumulative score and ELO rank bump charts
- Live session manager for seating a table and recording one round at a time
- Add game flow with manual score entry
- Analytics page with high-level player insights
- Player table arrangement page for seating drafts and sideline management
- Firebase Authentication with Google sign-in
- Firestore-backed player, game, session, and stats persistence
- Shared ELO engine with title band assignment
- Migration script for importing older spreadsheet data

## Technology Stack

- Next.js 14.2.3 (App Router)
- React 18
- TypeScript
- Tailwind CSS
- Firebase Authentication
- Firebase Firestore
- Recharts
- Vitest

## Repository Structure

- `app/` - Next.js app routes and page components
- `components/` - reusable UI components and page widgets
- `contexts/` - React context providers (`AuthContext`)
- `lib/` - Firebase client utilities, game logic, stats engine, and types
- `scripts/` - migration script for spreadsheet imports
- `__tests__/` - unit tests
- `firebase.json`, `firestore.rules`, `firestore.indexes.json` - Firebase configuration

## App Pages

### `/` (Home)
- Renders the dashboard content and the session manager side-by-side.
- Uses `DashboardContent` and `SessionManager`.

### `/dashboard`
- Renders only `DashboardContent`.
- Used for a focused dashboard view.

### `/analytics`
- Shows analytics cards for club performance and player metrics.
- Uses only Firestore subscriptions for games, players, and stats.

### `/login`
- Google sign-in page.
- Redirects back to home after sign-in.

### `/add-game`
- Manual round entry page.
- Selects 4 players and submits game scores.

### `/scores`
- Redirects to `/add-game`.

### `/tables`
- Seat arrangement page.
- Allows selecting players and generating table drafts.

### `/add-player`
- Page for adding a new player to Firestore.

## Components

### `DashboardContent`
- Subscribes to Firestore for players, games, playerStats, and eloEvents.
- Computes top players and renders:
  - cumulative score chart
  - ELO rank bump chart

### `SessionManager`
- Session game entry widget for admins.
- Lets admins select active players, draft them into tables, choose win type, and record a round.
- Validates zero-sum scores.
- Sends game data to Firestore via `createGame`.

### `ThemeToggle`, `BottomNavigation`, `Leaderboard`
- UI components for theme switching, navigation, and leaderboard display.

## Firebase and Firestore

### Firebase setup

- Firebase Auth must be enabled with Google sign-in.
- Firestore must be enabled.
- Copy `.env.example` to `.env.local` and provide config values.

### Firestore collections

- `players`
  - player profiles and metadata
- `games`
  - recorded round results and raw scores
- `playerStats`
  - aggregated statistics per player
- `eloEvents`
  - ELO changes per game and player
- `tableArrangements`
  - saved draft seating arrangements
- `sessions`
  - active and closed session metadata
- `appConfig`
  - club settings such as ELO starting rating and title bands

## Data Models

### `PlayerDoc`
- `id`: string
- `displayName`: string
- `title`: string
- `icon`: string
- `authUid`: string | null
- `createdAt`: Timestamp
- `active`: boolean

### `GameDoc`
- `id`: string
- `datetime`: Timestamp
- `createdBy`: string
- `tableId`: string | null
- `entries`: array of `{ playerId, score }`
- `winType`: `self_draw` | `discard` | `draw`
- `winnerPlayerId`: string | null
- `loserPlayerId`: string | null
- `fan`: number | null
- `notes`: string | null

### `EloEventDoc`
- `id`: string
- `gameId`: string
- `playerId`: string
- `datetime`: Timestamp
- `ratingBefore`: number
- `ratingAfter`: number
- `delta`: number
- `kFactor`: number
- `marginMultiplier`: number
- `opponents`: array of opponent results

### `PlayerStatsDoc`
- `playerId`: string
- `totalPoints`: number
- `gamesPlayed`: number
- `gamesWon`: number
- `gamesLost`: number
- `winLossRatio`: number
- `bestSingleGame`: number
- `worstSingleGame`: number
- `eloRating`: number
- `eloPeak`: number
- `eloRank`: number
- `pointsRank`: number
- `last5EloDelta`: number
- `recentEloDeltas`: number[]
- `daysAttended`: number
- `lastPlayedAt`: string | null
- `updatedAt`: Timestamp

### `SessionDoc`
- `id`: string
- `createdAt`: Timestamp
- `createdBy`: string
- `isActive`: boolean
- `tableCount`: number
- `participants`: string[]
- `tables`: Record<string, string[]>
- `sideline`: string[]
- `closedAt`: Timestamp | null

## Core Business Logic

### ELO and titles
- `lib/stats-engine.ts` contains the shared ELO calculator and title assignment logic.
- It updates player stats, recent deltas, and computes global rank lists.
- `assignTitle` maps total points to title bands.

### Game creation
- `lib/firestore.ts` contains `createGame`, which:
  - validates exactly 4 unique players
  - ensures scores sum to zero
  - stores the game document
  - creates ELO event docs
  - updates `playerStats`
  - recomputes global `eloRank` and `pointsRank`

### Session management
- `createSession` in `lib/firestore.ts` uses `assignSeats` to generate table and sideline assignments.
- `saveTableArrangement` stores draft table layouts.

## Local Development

### Prerequisites
- Node.js (compatible version for Next.js 14)
- npm

### Install dependencies

```bash
npm install
```

### Start development server

```bash
npm run dev
```

### Production build

```bash
npm run build
```

### Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Deployment

- Install the Firebase CLI.
- Run `firebase login`.
- Configure project in `.firebaserc`.
- Deploy with:

```bash
firebase deploy --only hosting,firestore:rules,firestore:indexes
```

## Important Files

- `app/layout.tsx` - app shell and providers
- `app/page.tsx` - home page
- `app/dashboard/page.tsx` - dashboard route
- `components/SessionManager.tsx` - live round entry
- `components/DashboardContent.tsx` - dashboard charts
- `lib/firestore.ts` - Firestore subscriptions and CRUD operations
- `lib/stats-engine.ts` - ELO and title logic
- `lib/types.ts` - shared Firestore schema types
- `contexts/AuthContext.tsx` - Firebase authentication state
- `scripts/migrate-from-sheet.ts` - legacy spreadsheet migration

## Notes

- The app currently uses Firebase client-side initialization from `lib/firebase.ts`.
- Only admins can record session games via `SessionManager`.
- The `/scores` route redirects to `/add-game`.
- `appConfig/settings` defines the club-specific scoring parameters.

## Future Improvements

- Add explicit session lifecycle UI beyond single-round entry
- Add audit history for saved table arrangements
- Add user role management beyond Google auth claims
- Add server-side validation / Cloud Functions for game writes
