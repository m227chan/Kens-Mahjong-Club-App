Ken's Mahjong Club — Technical Implementation Plan

Overview
--------
This plan defines the implementation for a static Next.js 14 application that reads and writes Mahjong score data from a Google Sheet. The app is optimized for mobile, uses TypeScript throughout, and deploys on Vercel free tier.

Key decisions
-------------
- Framework: Next.js 14 App Router in static export mode
- Styling: Tailwind CSS with a custom dark theme
- Charts: Recharts for cumulative and rank bump visualizations
- Data source: Google Sheets API v4, with a published sheet for public read and server-side auth for writes
- Auth: Google service account credentials kept server-side in Vercel environment variables
- Testing: Vitest for logic tests, React Testing Library for component tests

Architecture
------------
- Next.js app routes act as a thin server-side proxy to Google Sheets API
- No external database or third-party backend is required
- Client-side only consumes API routes and performs all transformation in TypeScript
- Polling every 30 seconds with manual refresh support ensures the leaderboard and dashboard stay up to date

File structure
--------------
Use the following project layout:

Ken-s-Mahjong-Club-Score-Tracker/
├── app/
│   ├── page.tsx                  (Leaderboard — default view)
│   ├── dashboard/page.tsx        (Dashboard with charts)
│   ├── scores/page.tsx           (Score log + entry form)
│   └── api/
│       └── scores/route.ts       (Google Sheets proxy)
├── components/
│   ├── Leaderboard.tsx
│   ├── LeaderboardRow.tsx
│   ├── ScoreEntryForm.tsx
│   ├── ScoreLog.tsx
│   ├── CumulativeScoreChart.tsx
│   ├── RankBumpChart.tsx
│   ├── PlayerFilter.tsx
│   ├── FanCalculator.tsx
│   └── OfflineBanner.tsx
├── lib/
│   ├── sheets.ts                 (Google Sheets API client)
│   ├── scoring.ts                (Fan→points, cumulative scores, rank calc)
│   ├── players.ts                (Player config, colors, title assignment)
│   └── types.ts                  (TypeScript interfaces)
├── __tests__/
│   ├── scoring.test.ts
│   ├── players.test.ts
│   └── sheets.test.ts
└── .env.local                    (GOOGLE_SERVICE_ACCOUNT_KEY, NEXT_PUBLIC_SHEET_ID)

Feature implementation
----------------------
Feature 1 — Leaderboard
- Implement the default `/` view to fetch derived player metrics and render the leaderboard
- Use `Leaderboard.tsx` and `LeaderboardRow.tsx` to show title, name, total score, rank, and ties as `=8`
- Animate row order changes with slide/fade transitions
- Apply fixed player colors and score-positive/negative styling consistently

Feature 2 — Score Entry
- Implement `/scores` with `ScoreEntryForm.tsx` and `ScoreLog.tsx`
- Render all active players in the score entry grid with default value `0`
- Provide a large mobile numeric keypad and per-player +/- toggle
- Validate zero-sum input before submission and disable submit until valid
- Append confirmed rounds via `POST /api/scores` and reload state after success
- Include `FanCalculator.tsx` as a collapsible reference panel in the score entry view

Feature 3 — Dashboard
- Implement `/dashboard` with `CumulativeScoreChart.tsx`, `RankBumpChart.tsx`, and `PlayerFilter.tsx`
- Use round number on the x-axis and datetime tooltips on hover/tap
- Highlight a selected player and dim others on interaction
- Refresh the chart data immediately after a new round is logged

API routes
----------
Use the App Router `/app/api/scores/route.ts` file with two methods:

GET /api/scores
- Fetches the full Game Scores tab from Google Sheets
- Parses header row and maps player columns
- Converts row values into typed `ScoreRound` objects
- Returns JSON payload with `rounds`, `players`, `timestamp`, and `offline` metadata

POST /api/scores
- Accepts a new round payload from the client
- Validates zero-sum score totals and required player fields
- Appends a row to the Google Sheet using the Sheets API
- Returns the appended row or error details

Data flow
---------
1. Client loads `/` and requests `GET /api/scores`
2. API route reads published sheet data and returns typed rows
3. Client stores data in React state and computes derived values
4. Utility functions calculate:
   - cumulative score history per player
   - current total scores
   - current ranking with tied ranks using `=8` formatting
   - title assignment based on rank
5. `/dashboard` renders charts from derived state
6. `/scores` renders entry form + log and POSTs new rounds via `/api/scores`
7. After successful write, client refreshes state and invalidates local cache

Client state and caching
------------------------
- Use React state and a shared context or top-level data loader
- Cache the most recent successful fetch in `sessionStorage`
- Poll `GET /api/scores` every 30 seconds via `useEffect`
- Provide a manual refresh button on both leaderboard and dashboard
- If fetch fails, show an offline amber banner and render cached data

Static config
-------------
Player colors are assigned dynamically from a 14-color palette by player index position in the sheet header row. Colors cycle for groups larger than 14 players.

Title assignment is dynamic based on total player count N:
- Rank 1 → 👑 Messiah
- Rank 2 → 🏆 Master
- Rank 3 to N-3 → 🧘 Monk
- Rank N-2 → 🪄 Minion
- Rank N-1 → 🐶 Mongrel
- Rank N → 🤡 Moron
- Ties shift titles down, new players always get Monk

Data model
----------
Primary types in `lib/types.ts`:
- `PlayerConfig`
- `ScoreRound`
- `ScoreEntry`
- `RoundRow`
- `DerivedPlayerMetrics`
- `RankedPlayer`

The Google Sheets tab uses headers:
`Datetime`, `Player1`, `Player2`, `Player3`, ... (dynamic player columns based on sheet header row)

Scoring logic
-------------
Implement all scoring utilities in `lib/scoring.ts`.

Fan-to-points table:
- 0 → 1
- 1 → 2
- 2 → 4
- 3 → 8
- 4 → 16
- 5 → 24
- 6 → 32
- 7 → 48
- 8 → 64
- 9 → 96
- 10 → 128

Hand calculation rules:
- Self draw: all non-winners pay `handValue`, winner receives `handValue × 3`
- Discard win: discarder pays `handValue × 2`, winner receives `handValue × 2`
- Round validation: all player scores must sum exactly to `0`
- Cumulative score: running sum of each player's scores in chronological order
- Ranking: sort descending by cumulative score, assign tied ranks the same number, and render ties as `=rank`
- Title assignment: dynamic based on total players N and effective rank (see constitution.md)

Dynamic title assignment function:
`assignTitles(rankings: LeaderboardEntry[], totalPlayers: number): LeaderboardEntry[]`
- Handles edge cases for N=4,5,6,7+
- New players with 0 rounds always get Monk title
- Ties cause all tied players to get the higher title of their shared rank

Google Sheets integration
-------------------------
`lib/sheets.ts` is the single integration point for sheet access.

Read flow:
- Use published sheet URL for reading data
- Parse the header row into player columns
- Parse each row into structured round records
- Return typed round data plus metadata

Write flow:
- Authenticate via service account key server-side only
- Append a new row with ISO timestamp and player scores
- Preserve correct player column order
- Return success or return an error when the API fails

Error handling:
- API routes should return HTTP 500 with descriptive error payloads
- Client displays inline messages for write failures and the sticky offline banner for fetch failures
- If the read route fails and sessionStorage has cached data, the app continues in read-only mode using cached state

UI implementation
-----------------
Page routing:
- `/` → Leaderboard default view
- `/dashboard` → Charts view
- `/scores` → Score entry + log view

Components:
- `Leaderboard.tsx` — main leaderboard table and header
- `LeaderboardRow.tsx` — animated row for each player
- `ScoreEntryForm.tsx` — dynamic grid for any number of players (responsive columns)
- `ScoreLog.tsx` — past rounds list with timestamps and scores
- `CumulativeScoreChart.tsx` — line chart for cumulative totals (dynamic player count)
- `RankBumpChart.tsx` — rank progression chart (dynamic y-axis domain)
- `PlayerFilter.tsx` — toggle player visibility (dynamic chip count)
- `FanCalculator.tsx` — collapsible reference panel for fan-to-points
- `OfflineBanner.tsx` — sticky warning bar when data fetch fails

Visual details:
- Dark theme: background `#0F172A`, cards `#1E293B`, text `#F1F5F9`
- Bottom nav: fixed tab bar with icons and labels for Leaderboard, Dashboard, Scores
- Animations: slide/fade transitions when leaderboard rank order changes
- Color usage: player hex colors for badges, chart lines, and score line indicators
- Score colors: positive scores in green, negative in red

Polling and refresh
-------------------
- Both leaderboard and dashboard use the same polling interval: 30 seconds
- A manual refresh button is exposed in both views
- Polling only fetches data when the tab is active and the component is mounted
- On submit of a new round, the client immediately refreshes state after successful write

Testing strategy
----------------
Unit tests (`__tests__/scoring.test.ts`, `players.test.ts`, `sheets.test.ts`):
- Validate fan-to-points conversion
- Confirm self draw and discard score calculations
- Confirm zero-sum validation rejects invalid rows
- Verify cumulative totals and rank/tie assignment logic
- Validate dynamic title assignment for various player counts (4,5,6,10,14 players)
- Test tie handling: multiple players at same rank get same title
- Test new player assignment: 0 rounds = Monk title
- Mock Google Sheets API responses for read/write flows
- Test dynamic player color assignment and cycling for >14 players
- Test getPlayerCount() with mocked sheet data

Component tests:
- Render leaderboard table and verify row order and tied rank display
- Validate score entry form behavior, input defaults, and zero-sum disabling
- Confirm offline banner appears when fetch fails
- Verify charts render expected data from sample rounds

Implementation phases
---------------------
1. Project setup
   - Scaffold Next.js 14 app with TypeScript and Tailwind CSS
   - Add Recharts, Vitest, React Testing Library
   - Create base app route structure and global styles
2. Data model + utilities
   - Implement `lib/types.ts`, `lib/players.ts`, `lib/scoring.ts`, and `lib/sheets.ts`
   - Add the fixed player color config and title mapping
3. API routes
   - Build `GET /api/scores` and `POST /api/scores`
   - Validate sheet integration and service account auth
4. UI pages
   - Implement leaderboard page and animated rows
   - Implement score entry page with form, validation, and log
   - Implement dashboard page with charts and filters
5. Offline + polling
   - Add sessionStorage caching, polling, manual refresh, and offline banner
6. Testing
   - Write unit and component tests for logic and UI
   - Add mocks for sheet read/write integration tests
7. Deployment
   - Configure Vercel environment variables
   - Connect GitHub repo and deploy from `main`

Deployment details
------------------
- GitHub repo name: `Ken-s-Mahjong-Club-Score-Tracker`
- Vercel: connect repo and deploy automatically on push
- Environment variables in Vercel:
  - `GOOGLE_SERVICE_ACCOUNT_KEY` (JSON string)
  - `NEXT_PUBLIC_SHEET_ID`
- Use `next export` or Vercel static export settings to ensure a static-friendly build

Risks and mitigations
---------------------
- Auth complexity: keep service account key only in server-side code and never expose it in client bundles
- Google Sheets rate limits: cache reads, batch polling, and avoid redundant fetches
- Mobile performance: keep the UI lightweight, use minimal DOM on charts, and limit render work during polling
- Data integrity: validate zero-sum submissions before write and confirm successful writes before UI update

Next steps
----------
- Review the implementation plan and confirm the exact Google Sheet tab name and header format
- Scaffold the Next.js app and initial `lib` utilities
- Implement the API proxy routes and local score parsing
- Build the main UI pages and add chart visualizations
