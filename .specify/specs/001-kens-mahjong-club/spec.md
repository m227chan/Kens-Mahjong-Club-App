Ken's Mahjong Club — Product Specification

Purpose
-------
Provide a lightweight, mobile-first static web app for tracking Hong Kong Mahjong scores for Ken's recurring club. The app replaces manual Google Sheets workflow while keeping the existing sheet as the canonical data source.

Audience
--------
- Non-technical players using iPhone or Android during game night
- Club members who need fast score logging, live standings, and analytics
- Anyone with the link: no login, no account, no install required

Primary Goals
-------------
- Keep score entry and leaderboard useable by first-time players
- Keep Google Sheets as the single source of truth
- Deliver a dark, data-dense UI with fast mobile performance
- Support live score updates, history logging, and player ranking insights

Data Source
-----------
Canonical datastore: Google Sheet at YOUR_GOOGLE_SHEET_ID (environment variable only)

The app reads directly from a published Google Sheet (File > Share > Publish to web). Write operations use the Google Sheets API with a service account API key injected as an environment variable at build time. The sheet is public read, but writes require the API key.

Core Data Model
---------------
- Players
  - Name
  - Title (derived from rank)
  - Persistent color
  - Current total score
  - Current rank

- Game Rounds
  - Timestamp
  - Scores object keyed by player name
  - Round number (sequence index)
  - Zero-sum validation enforced on submit

- Metrics
  - Cumulative running totals by round
  - Rank history by round

Player Titles
-------------
Derived dynamically from current rank and total player count N:

- Rank 1 → Messiah (always exactly 1)
- Rank 2 → Master (always exactly 1)
- Rank 3 to N-3 → Monk (all middle players)
- Rank N-2 → Minion (always exactly 1, unless tied)
- Rank N-1 → Mongrel (always exactly 1, unless tied)
- Rank N → Moron (always exactly 1, unless tied)

Special cases:
- New player with 0 games played → Monk by default
- Ties: all tied players get the same (higher) title
- Minimum 4 players required for title assignment

Edge cases by player count:
- N=4: Messiah, Master, Mongrel, Moron (no Monk/Minion)
- N=5: Messiah, Master, Monk, Mongrel, Moron
- N=6: Messiah, Master, Monk, Minion, Mongrel, Moron
- N=7+: Messiah, Master, [N-5 Monks], Minion, Mongrel, Moron

Current Players
---------------
Player names are read dynamically from the Google Sheet header row at runtime. The app supports any number of players (minimum 4, no maximum). Player colors are assigned by index from a rotating 14-color palette that cycles for groups larger than 14 players.

Feature 1 — Leaderboard
------------------------
Requirements:
- Ranked table with Title, Name, Total Score, Rank
- Live rank recalculation when scores update
- Equal scores share the same rank and tied rows display an equal-rank prefix like `=8`
- Title badges are visually prominent and color coded
- Score sign uses green for positive, red for negative
- Mobile-first, dark theme with clean typography
- Animated leaderboard transitions on score change

Acceptance criteria:
- Sorted descending by total score
- Shared ranks for tied totals
- Badges and row colors reflect title and score polarity
- Animations for score changes and rank movement
- Titles assigned dynamically based on total player count and rank positions

Feature 2 — Game Score Entry & Log
-------------------------------------
Requirements:
- Form to log a new round with an input for each active player
- Player list is fetched dynamically from sheet header at runtime
- Scores may be positive, negative, or zero
- All active players appear in every round entry form; non-participants are entered as 0
- Round timestamp assigned automatically on submit
- Round validation: player scores must sum to zero
- On success, append a new row to the sheet's Game Scores tab
- UI updates only after confirmed successful write
- Editable scrollable log of all past rounds below the form
- Log entries show datetime and player score values for each round
- Ability to add a new player from the UI
  - Adds the player to the sheet as a new column
  - Existing past rounds default to 0 for the new player
  - New player assigned Monk title and next available color

Implementation notes:
- Input grid should use compact responsive controls
- Layout adapts to player count: 2 columns for 4-8 players, 3 for 9-14, 4 for 15+
- Pre-fill all player score fields with 0 for each new round
- Provide a large mobile numeric keypad with a +/- toggle for quick negative entry
- Include a collapsible fan-to-points reference panel in the score entry view
- Show a running total of entered scores to help users keep sum at zero
- Disable submit until the round is valid
- Use an optimistic UI only after write confirmation to preserve data integrity

Feature 3 — Dynamic Dashboard
-----------------------------
Requirements:
- Cumulative Score Line Chart
  - x-axis = round number
  - y-axis = cumulative score
  - one persistent color per player (assigned by index)
  - lines animate on initial load
  - renders dynamically for any number of players
  - actual datetime timestamp shown in tooltip on hover/tap
- Rank Bump Chart
  - x-axis = round number
  - y-axis = rank (1 at top, totalPlayers at bottom)
  - lines cross as players overtake each other
  - load animation present
  - y-axis domain adjusts to total player count
- Both charts are interactive
  - tap/hover highlights a player line and dims others
  - player filter toggles visibility of each player (dynamic count)
- Charts refresh immediately after a new round is logged

Acceptance criteria:
- Persistent colors are consistent with leaderboard and score log
- Highlight states and opacity transitions are smooth
- Dashboard recalculates and re-renders quickly on new data
- Chart axes and labels remain readable on mobile
- Charts handle variable player counts gracefully

Sheet Integration
-----------------
Google Sheets structure requirements:
- Game Scores sheet stores one row per round
- Each row includes timestamp + scores for each player column
- Player columns are created dynamically when a new player is added
- Existing data is loaded from the sheet on app startup

Sync behavior:
- Read player list, score history, and current totals from the sheet
- Cache sheet reads locally in session storage to reduce API calls
- Poll the sheet every 30 seconds on the leaderboard and dashboard
- Provide a manual refresh button for on-demand reload
- Invalidate cache on round submission or player addition
- Write operations must be atomic and confirmed before UI state updates
- If the sheet is unreachable, display a banner: "Unable to reach scoresheet — displaying last cached data"
- Show clear error messaging if the Google Sheets write fails

Performance Requirements
------------------------
- Initial leaderboard/dashboard load within 2 seconds on mobile
- Minimize API calls to Google Sheets by batching reads
- Use caching for repeated reads during a session
- Smooth chart and table animations with no jank
- Keep bundle size small for static hosting

UI/UX Design
-----------
Visual style:
- Dark theme with high contrast typography
- Data-dense layout with clean spacing and readable values
- Fixed player colors tied to each player name across all components
- Score color-coding: green for positive, red for negative
- Title badges are bold, color-coded, and sized for easy scanning

Mobile behavior:
- Responsive stacking and compact inputs
- Swipe-friendly scroll areas for the game log
- Tap targets sized for thumb interaction
- No desktop-only hover dependencies; use tap for mobile highlight

Deployment
----------
- Static web app deployable to Vercel or GitHub Pages
- No server-side runtime required
- Uses only front-end code + Google Sheets API

Testing
-------
- Unit tests for score calculation logic
  - rank assignment
  - cumulative totals
  - zero-sum validation
  - title mapping
- Integration tests for Google Sheets read/write flows using mock data
- Chart rendering tests for accuracy of cumulative score and rank bump datasets
- UI tests for leaderboard sort, score entry validation, and player filter behavior

Deliverables
------------
- `speckit.specify` for app feature scope and behavior
- Mobile-first web interface with leaderboard, round entry, log, and charts
- Google Sheets sync for reading player data and writing new rounds
- Free-hostable static deployment config
- Tests covering calculation and sheet integration

Open questions
--------------
- Should the app support deleting or editing past round rows?
- Should player colors be assigned automatically or configurable by the user?
- What exact sheet tab name and header format exist in the live spreadsheet?
