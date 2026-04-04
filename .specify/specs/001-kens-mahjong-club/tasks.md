Ken's Mahjong Club — Task Breakdown

PHASE 1 — PROJECT FOUNDATION
1. Initialize a new Next.js 14 project with TypeScript and Tailwind CSS.
2. Configure Tailwind with custom dark theme tokens:
   - background: #0F172A
   - card: #1E293B
   - text: #F1F5F9
3. Install dependencies: `recharts`, `google-auth-library`, `googleapis`.
4. Create `.env.local` with placeholder values:
   - `GOOGLE_SERVICE_ACCOUNT_KEY=` 
   - `NEXT_PUBLIC_SHEET_ID=1Lasg0RUwCPSpiMQlL1VOaMf8D6HPET_WsB0W7Ow62Wo`
5. Set up Vitest and React Testing Library.
6. Create global layout with dark background and bottom navigation bar with 3 tabs: Leaderboard, Dashboard, Scores.

PHASE 2 — CORE DATA LAYER
[Parallel tasks]
- Create `lib/types.ts` with interfaces:
  - `Player { name, color, title, rank, totalScore }`
  - `GameRound { datetime, scores: Record<string, number> }`
  - `LeaderboardEntry { rank, title, player, score, isTied }`
  - `AppState { rounds, players, isOffline, lastUpdated }`

- Create `lib/players.ts` with:
  - 14-color palette array: `PLAYER_COLORS = ['#F59E0B', '#10B981', ...]`
  - `assignPlayerColors(playerNames: string[]) → Record<string, string>`
    - Maps each player name to a color by index position, cycles for >14 players
  - Title assignment function: `getRank(rank, totalPlayers) → title string` with emoji
    - Dynamic based on N: rank 1=Messiah, 2=Master, 3 to N-3=Monk, N-2=Minion, N-1=Mongrel, N=Moron
  - `getPlayerColor(name, playerNames) → hex string` (uses assignPlayerColors internally)
  - No hardcoded player names or PLAYER_ORDER constant

- Create `lib/scoring.ts` with:
  - `FAN_TO_POINTS` lookup: `{0:1, 1:2, 2:4, 3:8, 4:16, 5:24, 6:32, 7:48, 8:64, 9:96, 10:128}`
  - `calculateCumulativeScores(rounds) → Record<string, number[]>`
    - Returns running total per player across all rounds
  - `calculateRankings(totals, playerNames) → LeaderboardEntry[]`
    - Sort descending, handle ties with `=` prefix, assign dynamic titles based on totalPlayers
  - `validateRound(scores) → boolean`
    - Returns true only if all player scores sum to exactly 0
  - `assignTitles(rankings, totalPlayers) → LeaderboardEntry[]`
    - Dynamic title assignment: rank 1=Messiah, 2=Master, 3 to N-3=Monk, N-2=Minion, N-1=Mongrel, N=Moron
    - Handles ties by giving all tied players the higher title
    - New players (0 rounds) always get Monk
  - `calculateRoundFromFan(fan, winType, winnerName, discarderName?, players[]) → Record<string, number>`
    - `winType`: `'self-draw' | 'discard'`

PHASE 3 — TESTS FOR DATA LAYER
[Parallel tasks]
- Create `__tests__/scoring.test.ts`:
  - `validateRound`: valid round sums to 0, invalid round rejected
  - `calculateCumulativeScores`: correct running totals across 3 rounds
  - `calculateRankings`: correct rank order, tie detection (`=8`), correct dynamic title assignment
  - `assignTitles`: test for 4,5,6,10,14 players with correct title bands
  - `assignTitles`: tie at rank 1 gives two Messiahs, tie at last rank gives two Morons
  - `assignTitles`: new player with 0 rounds gets Monk title
  - `FAN_TO_POINTS`: spot check `0→1`, `4→16`, `10→128`
  - `calculateRoundFromFan`: self-draw distributes correctly, discard charges only discarder

- Create `__tests__/players.test.ts`:
  - `assignPlayerColors`: assigns colors by index, cycles correctly for 15 players
  - `getPlayerColor`: returns correct hex for given name and player list
  - `getRank`: returns correct title for ranks 1,2,3,5,9,12,14 with different N values

PHASE 4 — GOOGLE SHEETS INTEGRATION
Sequential tasks
1. Create `lib/sheets.ts` with:
   - `initSheetsClient()` using `GOOGLE_SERVICE_ACCOUNT_KEY` env var
   - `getGameRounds() → GameRound[]`
     - Fetches Game Scores tab, skips header row, skips Totals row
     - Parses datetime and player scores by column position
     - Returns player names dynamically from header row
   - `appendGameRound(round: GameRound) → void`
     - Appends new row in correct player column order (from sheet header)
     - Uses ISO timestamp in column A
   - `getPlayerCount() → number` (returns number of player columns)
   - `addPlayer(newPlayerName) → void` (appends column to header, fills existing rows with 0)
   - Error handling: catch API errors, return `{ data, isOffline: true }`

2. Create `app/api/scores/route.ts`:
   - GET handler: calls `getGameRounds()`, returns JSON
   - POST handler: validates request body, calls `appendGameRound()`, returns success/error JSON
   - Never expose `GOOGLE_SERVICE_ACCOUNT_KEY` to client

3. Create `__tests__/sheets.test.ts`:
   - Mock `googleapis` and test that `getGameRounds()` parses rows correctly
   - Test that `appendGameRound()` sends correct row array in player order
   - Test `getPlayerCount()` returns correct number from mocked header
   - Test `addPlayer()` appends column and fills with zeros
   - Test that API errors return `isOffline` flag

PHASE 5 — LEADERBOARD FEATURE
1. Create `components/OfflineBanner.tsx`:
   - Sticky amber banner at top when `isOffline=true`
   - Message: "⚠️ Unable to reach scoresheet — displaying last cached data"

2. Create `components/LeaderboardRow.tsx`:
   - Props: `LeaderboardEntry + isHighlighted`
   - Shows: rank (with `=` prefix for ties), title badge, player name, score
   - Score colored green if positive, red if negative, gray if zero
   - Title badge background uses player color at 20% opacity
   - Smooth slide+fade animation on rank change via CSS transition

3. Create `components/Leaderboard.tsx`:
   - Fetches from `/api/scores` every 30 seconds via `useEffect`
   - Computes rankings client-side using `calculateRankings()`
   - Renders sorted `LeaderboardRow` list with `AnimatePresence` or transition animations
   - Shows `OfflineBanner` if `isOffline`
   - Shows last updated timestamp bottom right
   - Shows loading skeleton on first fetch

4. Create `app/page.tsx` that renders the `Leaderboard` component.

PHASE 6 — SCORE ENTRY & LOG FEATURE
1. Create `components/FanCalculator.tsx`:
   - Collapsible panel (collapsed by default)
   - Shows fan→points table: `0fan=1pt` through `10fan=128pts` (limit)
   - Two columns: Fan count | Points
   - Highlight rows `3-fan` and above in green

2. Create `components/ScoreEntryForm.tsx`:
   - Lists all players dynamically from sheet header with large touch-friendly score inputs
   - Each input has +/- toggle button and numeric-only keyboard
   - Pre-filled with `0` for all players
   - Responsive grid: 2 columns for 4-8 players, 3 for 9-14, 4 for 15+
   - Live zero-sum validator: shows running total, turns green at 0, red otherwise with message "Scores must sum to 0"
   - Submit button disabled until sum = 0
   - On submit: POST to `/api/scores`, optimistic UI update, show success toast or error message
   - Include `FanCalculator` panel collapsible above the form
   - Add Player section: text input + button to add new player dynamically

3. Create `components/ScoreLog.tsx`:
   - Scrollable table of all past rounds
   - Columns: Datetime | one column per player (dynamic count)
   - Player columns use their assigned color for the header
   - Positive scores green, negative red, zeros gray
   - Most recent round at top
   - Totals row pinned at bottom matching current leaderboard totals

4. Create `app/scores/page.tsx` that renders `ScoreEntryForm` and `ScoreLog`.

PHASE 7 — DASHBOARD FEATURE
[Parallel tasks]
- Create `components/PlayerFilter.tsx`:
  - Row of toggle chips, one per player (dynamic count from sheet)
  - Each chip uses player color when active, gray when inactive
  - "All" and "None" quick select buttons
  - Passes active player set to parent via callback

- Create `components/CumulativeScoreChart.tsx`:
  - Uses Recharts `LineChart`
  - X-axis: round number (1, 2, 3...)
  - Y-axis: cumulative score (auto domain)
  - One `Line` per player using dynamic color assignment
  - Tooltip shows datetime + all player scores on hover
  - Click/tap a line to highlight it and dim others to 20% opacity
  - Animated line draw on mount
  - Respects `PlayerFilter` active set
  - Dark theme with white axis labels

- Create `components/RankBumpChart.tsx`:
  - Uses Recharts `LineChart` with reversed Y-axis (rank 1 at top)
  - X-axis: round number
  - Y-axis: rank (1 to totalPlayers, integer ticks)
  - One `Line` per player using dynamic color assignment
  - Tooltip shows round number + all player ranks on hover
  - Click/tap to highlight individual player
  - Animated on mount
  - Respects `PlayerFilter` active set

- Create `app/dashboard/page.tsx`:
  - Renders `PlayerFilter`, `CumulativeScoreChart`, and `RankBumpChart`
  - Shared player filter state controls both charts simultaneously
  - Fetches fresh data from `/api/scores` on mount and every 30 seconds
  - Charts re-render smoothly when new data arrives

PHASE 8 — DEPLOYMENT
1. Create `vercel.json` with build configuration.
2. Add `README.md` with setup instructions:
   - clone repo
   - install dependencies
   - set env vars
   - run local dev server
   - deploy to Vercel
   - share URL with the group
3. Push code to GitHub.
4. Connect GitHub repo to Vercel.
5. Document required Vercel environment variables:
   - `GOOGLE_SERVICE_ACCOUNT_KEY`
   - `NEXT_PUBLIC_SHEET_ID`

CHECKPOINT VALIDATIONS
- After Phase 3: run `npm test` — all scoring and player tests must pass.
- After Phase 4: test `GET /api/scores` returns real data from the sheet.
- After Phase 5: leaderboard renders correctly with the highest-scoring player at rank 1.
- After Phase 6: submit a test round, verify it appears in the sheet.
- After Phase 7: both charts render all players with correct colors.
- After Phase 8: production URL loads on mobile in under 2 seconds.
