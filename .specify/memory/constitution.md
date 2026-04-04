Ken's Mahjong Club Web App Constitution

1. SIMPLICITY FIRST
- The app is built for non-technical players using phones during game night.
- Every interaction must be self-evident and usable without prior training.
- No logins, no accounts, no onboarding flows; the app opens directly to gameplay and score tracking.
- Prefer fewer, polished features rather than many half-finished capabilities.

2. DATA INTEGRITY
- Score data is the single source of truth; the app never loses, overwrites, or corrupts it.
- Every score entry must include a timestamp at the moment it is recorded.
- Google Sheets is the canonical datastore; the app reads from and writes to the sheet directly.
- All write operations must be atomic and fully confirmed before updating the UI.

3. PERFORMANCE
- Leaderboard and dashboard screens must load in under 2 seconds on a mobile device.
- Charts and rank/score transitions must render smoothly with no visible jank.
- Minimize Google Sheets API calls and cache read results when it improves responsiveness.

4. UI/UX STANDARDS
- Use a clean, dark-themed design language that is data-dense yet easy to read (similar to Looker/Linear).
- Build mobile-first layouts optimized for iPhone and Android browsers.
- Color-code players consistently across leaderboard, charts, and score log views.
- Use green tones for positive scores and red tones for negative scores.
- Make player titles (Messiah, Master, Magician, Monk, Minion, Mongrel, Moron) visually prominent.

5. TECH CONSTRAINTS
- The app must be free to host and operate with no paid services required.
- No backend server is required; use the Google Sheets API as the database.
- The app must be deployable as a static web app on Vercel, GitHub Pages, or equivalent.
- It must work on all modern mobile browsers without requiring installation.

6. TESTING STANDARDS
- All score calculation logic must have unit tests.
- Google Sheets read/write workflows must be integration tested using mock sheet data.
- Dashboard chart rendering must be tested for data accuracy against known inputs.

TITLE ASSIGNMENT
- Rank 1 → 👑 Messiah
- Rank 2 → 🏆 Master
- Rank 3 to N-3 → 🧘 Monk (where N = total players)
- Rank N-2 → 🪄 Minion
- Rank N-1 → 🐶 Mongrel
- Rank N → 🤡 Moron
- Ties: all tied players get the higher title of their shared rank
- New players with 0 games: always 🧘 Monk regardless of standings
