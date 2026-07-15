# QR Table Check-In and Mobile Scorekeeping

Status: implementation specification  
Source idea: [GitHub issue #10](https://github.com/m227chan/Kens-Mahjong-Club-App/issues/10)  
Primary use case: one permanent QR code per physical Mahjong table, scanned from a phone

## 1. Executive summary

Add permanent, printable QR codes for physical Tables 1–8. Scanning a code should:

1. Keep the user on the table-check-in route while they sign in with Google, if needed.
2. Treat a valid QR code as an invitation to the associated club.
3. Resolve the signed-in account to exactly one roster player in that club.
4. Add that player to the active session and scanned table in one atomic operation.
5. Start an active session automatically if none exists.
6. Open a mobile-first, full-screen view of only that table.
7. Let the table record wins and draws with the same rules as the normal Session Manager.

The QR code itself is free. It only contains a URL. Generate it locally in the application with the open-source [`qrcode`](https://github.com/soldair/node-qrcode) package; do not use a paid “dynamic QR” provider. The package can generate SVG or PNG, works on the server or client, and is MIT licensed. Scanning the code therefore has no per-scan vendor cost.

The principal technical risk is concurrency. `SessionManager` currently reads and writes the complete `sessions.tables` JSON object from the browser. Multiple phones doing that can overwrite one another. All table seating operations introduced by this feature, and the equivalent operations in the normal Session Manager, must go through a shared server-side transactional service before this feature is considered complete.

## 2. Product decisions

These decisions remove ambiguity for the implementation agent.

- A QR code represents a **physical club table number**, not a particular session.
- A club can enable Tables 1–8 initially. The schema should not prevent supporting more later.
- QR codes are permanent until a manager disables or rotates them.
- A valid QR code is a bearer invitation. After Google sign-in, it may add the scanner to the club as a normal member, never as a manager.
- A user can have only one active linked roster player per club.
- A roster player can be linked to only one account at a time.
- A player can occupy at most one table in the active session.
- A table can contain at most four players.
- Moving to a non-full table is automatic. Moving to a full table requires choosing an occupant to replace.
- Replaced or removed players remain session participants and move to the sideline.
- Adding a roster player to a table also adds that player to `session.participants`; there is no separate “add to session” step.
- Automatic inactivity cleanup clears seats but does not close the session or delete participants.
- “Full-screen table” is a focused application view, not the browser Fullscreen API. It must work without asking for browser permissions.

## 3. Existing architecture this feature must respect

Relevant current files:

- `contexts/AuthContext.tsx`: Firebase Google authentication and universal-club enrollment.
- `app/login/page.tsx`: currently redirects authenticated users to `/`, so it cannot preserve a QR destination by itself.
- `app/club/[clubId]/page.tsx`: requires active club membership before rendering the club workspace.
- `components/ClubWorkspace.tsx`: roster linking and the normal club page.
- `components/SessionManager.tsx`: active-session UI, table seating, clear/remove/swap behavior, score calculation, and game submission.
- `lib/session-layout.ts`: canonical numeric table keys (`"1"`, `"2"`, etc.) and sideline recovery.
- `lib/supabase-data.ts`: client subscriptions and current direct session updates.
- `app/api/supabase-data/route.ts`: authenticated server mutations for membership, player linking, and session creation.
- `lib/server/supabase-game-management.ts`: transactional and idempotent game creation plus stats updates.
- `supabase/migrations/0001_initial_schema.sql`: `players`, `sessions`, Realtime, and RLS definitions.

Current behaviors that need deliberate changes:

- Normal session creation rejects fewer than four participants. QR session creation must be a separate, narrowly authorized path that permits one initial participant.
- Creating a roster player is manager-only. QR onboarding needs a separate self-profile operation that can only create a player linked to the caller.
- Session layout updates write the whole session from the client. This is unsafe once several phones can mutate seating concurrently.
- The scoring workflow is embedded inside `SessionManager`. It should be extracted and shared rather than copied.
- The root layout always shows the normal application header. The focused table route needs a route-aware shell/body class to hide it.

## 4. Free QR-code setup

### 4.1 Generation

Install the open-source generator:

```bash
npm install qrcode
npm install --save-dev @types/qrcode
```

Generate SVG for screen preview and printing. Recommended options:

- error correction: `Q` for printed cards;
- dark modules on a white background;
- quiet zone/margin: at least four modules;
- printed size: at least 35–40 mm square;
- include human-readable “Table N” and club name outside the code;
- never place a logo over the data modules in the first version.

Provide both:

- **Download SVG** for an individual table; and
- **Print all** for a browser-printable Letter/A4 sheet of enabled tables.

No generated image needs to be stored in Supabase Storage. Regenerate it from the signed URL whenever a manager opens the QR settings page.

### 4.2 Canonical URL

Use `NEXT_PUBLIC_APP_URL` as the canonical origin so production codes do not accidentally contain a preview or localhost domain.

Recommended QR URL:

```text
https://app.example.com/check-in/{publicId}#k={signature}
```

The fragment (`#k=`) is not sent in HTTP request URLs or referrer headers. On first render:

1. Read the signature from `window.location.hash`.
2. Save it temporarily in `sessionStorage` under the `publicId`.
3. Remove the fragment with `history.replaceState`.
4. Submit it only to the authenticated check-in exchange endpoint.
5. Delete it from `sessionStorage` after a successful exchange.

Do not put the club ID, database session ID, Firebase UID, player ID, or any service key in the QR code.

### 4.3 Signing and rotation

Add a server-only `QR_SIGNING_SECRET` deployment variable. Generate a high-entropy value once and store it in local/deployment secret storage, never in Git.

For each configured table, persist a random `public_id` and integer `token_version`. Derive the signature as:

```text
base64url(HMAC-SHA256(QR_SIGNING_SECRET, "v1:{clubId}:{tableNumber}:{tokenVersion}:{publicId}"))
```

The server recomputes and compares signatures with a timing-safe comparison. This design allows managers to re-download the same QR without storing its bearer secret in plaintext. Rotating a table increments `token_version`, immediately invalidating old printouts.

## 5. Database changes

Create `supabase/migrations/0005_qr_table_checkin.sql`.

### 5.1 `club_qr_tables`

```sql
create table public.club_qr_tables (
  id text primary key default encode(gen_random_bytes(10), 'hex'),
  club_id text not null references public.clubs(id) on delete cascade,
  table_number integer not null check (table_number > 0),
  label text,
  public_id text not null unique default encode(gen_random_bytes(16), 'hex'),
  token_version integer not null default 1 check (token_version > 0),
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (club_id, table_number)
);
```

Only managers may list, create, enable, disable, or rotate these records. The public check-in route must resolve a `public_id` through a server endpoint; do not add a public anonymous RLS policy.

### 5.2 `session_table_activity`

```sql
create table public.session_table_activity (
  session_id text not null references public.sessions(id) on delete cascade,
  table_number integer not null check (table_number > 0),
  occupied_since timestamptz,
  last_game_at timestamptz,
  last_roster_change_at timestamptz not null default now(),
  cleared_at timestamptz,
  primary key (session_id, table_number)
);
```

Interpret the inactivity deadline as:

```text
coalesce(last_game_at, occupied_since) + 2 hours
```

When a table changes from empty to occupied, set `occupied_since`. Do not continuously extend the deadline merely because another player joins. Recording a game sets `last_game_at`. Clearing the table nulls `occupied_since` and `last_game_at` and sets `cleared_at`.

### 5.3 Session revision and identity constraints

Add a revision to prevent stale whole-document writes:

```sql
alter table public.sessions
  add column revision bigint not null default 0;
```

Add database enforcement for account-to-player uniqueness:

```sql
create unique index players_one_active_auth_link_per_club
  on public.players(club_id, auth_uid)
  where active and auth_uid is not null;
```

The application already enforces this rule, but concurrent QR onboarding needs database enforcement too.

### 5.4 Realtime

`sessions` is already in the Supabase Realtime publication. The focused page can subscribe to the active session using the existing `subscribeActiveSession` flow. Add `session_table_activity` to Realtime only if the UI displays a live inactivity countdown; it is not required for the first version.

## 6. Server-side service design

Create a focused service instead of expanding the monolithic route further:

- `lib/server/table-checkin.ts`: transaction and validation logic.
- `app/api/table-checkin/route.ts`: authenticated player/check-in actions.
- `app/api/table-qr/route.ts`: manager-only QR administration and signed URL generation.
- `lib/table-checkin-client.ts`: typed browser calls.

Every action must verify the Firebase ID token with `adminAuth.verifyIdToken`. Every state-changing seating operation must acquire the club session advisory lock and lock the active session row `FOR UPDATE`.

Recommended common lock:

```sql
select pg_advisory_xact_lock(hashtext('session:' || $1));
```

### 6.1 Table context

`GET_CONTEXT` input:

```ts
{ clubId: string; tableNumber: number }
```

Requirements:

- caller must be an active club member;
- return club label, active season, active session ID/revision, requested table occupants, linked player, and active roster search data needed by the picker;
- never return QR signing information;
- return a distinct `session_missing` state rather than treating it as an error.

### 6.2 QR exchange

`EXCHANGE_QR` input:

```ts
{ publicId: string; signature: string }
```

Transaction:

1. Resolve enabled `club_qr_tables` by `public_id`.
2. Recompute and timing-safely validate the signature.
3. Rate-limit repeated failures by IP/public ID at the application layer.
4. Upsert the authenticated user into `club_members` as an active `member` if missing.
5. Never alter an existing manager role.
6. Return `{ clubId, tableNumber, playerResolution }`.

`playerResolution` is one of:

- `{ status: 'linked', playerId }`
- `{ status: 'needs_identity', unlinkedPlayers: [...] }`

After exchange, the QR token has served its purpose. Normal membership and authenticated server actions authorize the focused page.

### 6.3 Resolve the caller's roster identity

`LINK_SELF`:

- accepts an active, unlinked player ID in the QR's club;
- may only set `auth_uid` to the caller's UID;
- fails if that player was linked concurrently;
- fails if the caller already has a linked active player in the club.

`CREATE_SELF_PLAYER`:

- creates an active roster player with `auth_uid = caller.uid`;
- defaults the display name from the Firebase profile but allows editing before confirmation;
- uses the existing emoji picker and uniqueness behavior;
- may not create an unlinked player or a player for another UID;
- is the only non-manager player-creation exception.

Do not seat an unresolved account. Once identity is resolved, immediately run the check-in transaction below.

### 6.4 Atomic check-in

`CHECK_IN_SELF` input:

```ts
{ clubId: string; tableNumber: number; replacePlayerId?: string }
```

Algorithm under the session lock:

1. Verify membership and find the caller's linked active player.
2. Read the club's `active_season_number`.
3. Load and lock the active session.
4. If no active session exists, create one with:
   - the linked player as the only participant;
   - `table_count = tableNumber`;
   - all numeric tables through `tableNumber` present;
   - the linked player seated at the scanned table;
   - an empty sideline.
5. If a session exists in another season, close it and create one for the active season.
6. Extend `table_count` and numeric table keys if the scanned table is above the current count.
7. Normalize the existing layout before mutation.
8. Inspect the target before removing the caller from an old table.
9. If the target has four players and no valid `replacePlayerId`, return `table_full` with its occupants and make no layout change.
10. If replacing, remove the chosen occupant from the target and add them to the sideline.
11. Remove the caller's linked player from every other table and from the sideline.
12. Add the caller's player to `participants` if missing and seat them at the target.
13. Enforce four unique players maximum.
14. Update activity, increment `revision`, and return the authoritative session.

This produces the required behavior:

- scanning a second table moves the player automatically when a seat is open;
- a full destination does not strand them by prematurely removing them from their old table;
- replacement happens atomically after explicit confirmation.

### 6.5 Add, move, replace, remove, and clear

Provide shared transactional operations used by both UIs:

- `SEAT_PLAYER(tableNumber, playerId, replacePlayerId?)`
- `REMOVE_PLAYER(tableNumber, playerId)`
- `CLEAR_TABLE(tableNumber)`
- `CLEAR_ALL_TABLES()`

Rules:

- `SEAT_PLAYER` automatically adds the player to `participants`.
- If the player is on the sideline, remove them from it.
- If the player is at another table, remove them there before seating them here.
- If the destination is full, require an explicit replacement choice.
- `REMOVE_PLAYER` and `CLEAR_TABLE` move affected players to the sideline without removing them from `participants`.
- Every operation normalizes, validates, increments `revision`, and returns the authoritative session.

Refactor the corresponding functions in `SessionManager` (`persistSession`, `clearSingleTable`, `removeToSideline`, `pickPlayer`, swap, and drag/drop mutations) to call this same service. Leaving the normal UI on direct whole-JSON writes would reintroduce lost updates.

### 6.6 Record a result

Extract the scoring state and controls from `SessionManager` into shared code, for example:

- `lib/table-scoring.ts`: fan table and pure score calculation;
- `components/TableResultControls.tsx`: winner/draw interaction;
- `hooks/useTableGameSubmission.ts`: idempotency and save state.

Both the normal and focused table views must submit through the existing transactional `createGame` path with:

- exactly the current four table occupants;
- current active season;
- numeric `tableId`;
- existing self-draw/discard/draw scoring behavior;
- an idempotency key retained across retries.

Within the same game transaction, upsert `session_table_activity.last_game_at = now()` for the matching active session/table. A failed game save must not update activity.

## 7. Authentication and first-time-user flow

### 7.1 Signed-out scanner

Do not send the scanner to the current `/login` page because it always redirects authenticated users to `/` and loses table intent.

The `/check-in/[publicId]` page should render a compact sign-in state in place:

- “Check in to Table N” only after a safe server preflight, or generic “Table check-in” before authentication;
- “Continue with Google” using the existing `signInWithGoogle` popup;
- retain the fragment signature in `sessionStorage` during authentication;
- wait for `AuthContext.loading === false` and any universal-membership token refresh before exchanging the QR.

If the popup is blocked, reuse the existing Safari-specific error language.

### 7.2 First account visit

After successful authentication and QR exchange:

1. If a linked player exists, check in immediately.
2. Otherwise show a required “Who are you?” screen.
3. First section: searchable unlinked roster players with name and emoji.
4. Second action: “Create me as a new player.”
5. Require confirmation before linking an existing record to prevent accidental identity theft.
6. Once linked/created, persist the link and never ask again for that club unless the user later unlinks.

The global first-time Ming welcome should not interrupt this flow. Because the focused route does not need the normal club tour, defer that welcome until the user visits the normal club workspace. Do not mark it completed merely because a QR route was visited.

### 7.3 Invalid and rotated codes

Show a friendly terminal state:

> This table code is no longer active. Ask the club manager for the current QR code.

Never reveal whether the public ID or signature was the invalid portion.

## 8. Focused mobile table UI

Canonical authenticated route:

```text
/club/{clubId}/table/{tableNumber}
```

The QR exchange redirects here after membership, identity resolution, and check-in. The expand icon in the normal Session Manager links here directly.

### 8.1 Layout

Use a focused shell that temporarily adds a body class such as `table-focus-mode`. That class should hide the root `club-header`, remove the desktop max-width framing, and restore everything on unmount.

Mobile layout from top to bottom:

1. **Sticky compact header**
   - back arrow to `/club/{clubId}`;
   - club name in small text;
   - “Table N” as the main title;
   - live/offline/saving indicator;
   - overflow menu for “Clear table.”
2. **Four-seat grid**
   - two columns on typical phones;
   - one column on very narrow screens if necessary;
   - large emoji and player name;
   - small `×` remove button on every occupied seat;
   - empty seats are large “+ Add player” targets;
   - the signed-in user's player gets a subtle “You” badge.
3. **Status strip**
   - `2 of 4 players` or `Ready to score`;
   - explain that four players are required to record a result.
4. **Sticky bottom scoring bar**
   - “Draw (0 pts)” secondary button;
   - “Winner…” primary button;
   - safe-area padding for iPhone browser chrome;
   - disabled until four players are present or while saving.
5. **Result sheet/dialog**
   - reuse the normal winner, self-draw/discard, loser, and fan controls;
   - fit within one mobile viewport with internal scroll where needed;
   - show computed score deltas before confirmation;
   - success animation/toast without navigating away.

Minimum touch target: 44×44 CSS pixels. Avoid hover-only controls in this route.

### 8.2 Add-player interaction

Tapping an empty seat opens a bottom sheet with one search field and all active roster players. Each result should state one of:

- `At this table`
- `Table N`
- `Sideline`
- `Not in session`

One tap should seat a sideline/not-in-session player. For a player at another table, require a move confirmation. If the current table becomes full between selection and save, show the authoritative occupants and replacement flow rather than silently failing.

### 8.3 Full-table replacement

When a scanner checks into a full table, show:

> Table N is full. Choose someone to move to the sideline, or go back.

Display the four occupant cards. Selecting one opens a final confirmation. The server must revalidate that the selected occupant is still present before committing.

### 8.4 Normal Session Manager affordance

Add a small expand/focus icon to every table card:

- visible on card hover for mouse users;
- always visible or revealed with the existing table actions on touch layouts;
- `aria-label="Open Table N in focused view"`;
- links to the canonical authenticated focused route;
- does not require rescanning the QR.

## 9. Two-hour inactivity cleanup

### 9.1 Required behavior

If a non-empty table has no logged game for more than two hours:

- move every occupant to the active session sideline;
- leave them in `participants`;
- leave the table present but empty;
- increment session revision;
- publish the normal Realtime session update;
- do not alter game logs.

For a newly occupied table with no games, start the two-hour window at `occupied_since`.

### 9.2 Cleanup function

Implement an idempotent Postgres function, for example `clear_stale_session_tables()`, that:

1. finds stale, non-empty active-session tables;
2. locks each affected session;
3. rechecks its deadline under the lock;
4. moves unique occupants to the sideline;
5. clears only the affected table key;
6. updates activity and revision.

Schedule it every five minutes with Supabase Cron/`pg_cron`. Supabase documents that Cron can execute SQL or database functions directly in Postgres, so no paid external scheduler or Edge Function is required: [Supabase Cron documentation](https://supabase.com/docs/guides/cron) and [quickstart](https://supabase.com/docs/guides/cron/quickstart).

Also invoke the same cleanup logic lazily before `GET_CONTEXT`, check-in, seating mutation, and game submission. This guarantees correct behavior even if Cron is temporarily unavailable and makes local development deterministic.

## 10. Concurrency, consistency, and offline behavior

- The server response, not optimistic local state, is authoritative after every seating mutation.
- Realtime updates keep all open phones and the normal Session Manager synchronized.
- Use the session advisory lock plus `FOR UPDATE`; never depend on client-side “four seats” checks.
- Increment `sessions.revision` on every layout mutation.
- If retaining any whole-session update endpoint, require `expectedRevision` and return HTTP 409 with the latest session on conflict.
- Game saves already support idempotency. Preserve that behavior in the focused UI.
- Disable result submission while offline. Do not queue Mahjong results automatically because replaying them after roster changes could score the wrong people.
- A lost connection may keep showing the last table state, but it must show an offline banner and block mutations until reconnected.
- On reconnection, refetch context before enabling controls.

## 11. Authorization and abuse controls

- All meaningful actions require Firebase authentication.
- QR validity is checked server-side; client-decoded fields are never trusted.
- QR exchange may create only a normal member role.
- Self-player creation may link only to the caller's UID.
- Existing linked players cannot be claimed by another user.
- Managers retain their role during membership upserts.
- QR management is manager-only.
- Rate-limit invalid exchanges and repeated roster-identity mutations.
- Record security-relevant server logs with club/table/public ID and caller UID, but never log the QR signature, Firebase token, email, or signing secret.
- Display a warning in manager settings: anyone with a photo of an active code can join/check in. Provide Rotate and Disable actions.
- Do not expose `QR_SIGNING_SECRET` through a `NEXT_PUBLIC_*` variable.

## 12. Manager QR settings UI

Add a “Table QR codes” section to club Settings for managers:

- first-use action: “Create codes for Tables 1–8”;
- per-table card: label, enabled state, QR preview, Download SVG, Print, Rotate, Disable/Enable;
- “Print all enabled tables” sheet;
- rotation confirmation explaining that old printouts stop working;
- show the canonical production origin used in codes;
- block generation if `NEXT_PUBLIC_APP_URL` is missing or not HTTPS in production;
- never show the signing secret.

QR settings configure physical tables only. They must not start a session or change the active session's table count until a code is scanned.

## 13. Suggested component and file structure

```text
app/
  check-in/[publicId]/page.tsx          # sign-in, exchange, identity resolution
  club/[clubId]/table/[tableNumber]/page.tsx
  api/table-checkin/route.ts
  api/table-qr/route.ts
components/
  FocusedTableView.tsx
  TableSeatGrid.tsx
  TablePlayerPicker.tsx
  TableResultControls.tsx
  TableIdentityResolver.tsx
  TableQrSettings.tsx
hooks/
  useFocusedTable.ts
  useTableGameSubmission.ts
lib/
  table-scoring.ts
  table-checkin-client.ts
  qr-signing.ts                       # server-only signing helper
  server/table-checkin.ts
supabase/migrations/
  0005_qr_table_checkin.sql
```

Names may change, but keep QR administration, table transactions, pure scoring, and presentation separated.

## 14. Implementation sequence

1. Add the migration, indexes, session revision, activity table, cleanup function, and tests.
2. Add server-only QR signing and manager CRUD endpoints.
3. Build manager preview/download/print UI and verify real phone scanning.
4. Build authenticated QR exchange and preserved sign-in route.
5. Add self-link/create identity resolution.
6. Implement atomic server table mutations and migrate normal Session Manager mutations to them.
7. Extract shared scoring logic and result controls with regression tests.
8. Build the focused mobile route and Realtime synchronization.
9. Add inactivity tracking, lazy cleanup, then Supabase Cron.
10. Add the normal table-card focus icon.
11. Complete mobile, concurrency, security, and end-to-end testing.

Do not start with the QR image. The transactional seating service is the foundation; a QR code is only another way to reach it.

## 15. Acceptance criteria

### QR and authentication

- A manager can generate, preview, download, print, rotate, disable, and re-enable Tables 1–8 without a paid QR provider.
- A signed-out scanner can sign in and returns to the intended table flow.
- A rotated or disabled code cannot be exchanged.
- No secret/token appears in server access logs after the initial page request because the signature is in the fragment.

### Identity

- A previously linked user is seated without another identity prompt.
- An unlinked user can claim an unlinked roster player or create exactly one self-linked player.
- Two users racing to claim the same player produce one success and one clear failure.
- The full app tour does not block first-time QR onboarding.

### Sessions and seating

- Scanning with no active session creates one with the caller at the scanned table, even with fewer than four participants.
- Scanning a table above the current table count extends the active session safely.
- Adding any roster player to the table also adds them to session participants.
- A table never exceeds four unique players.
- A player never remains at two tables.
- Scanning another non-full table moves the linked player automatically.
- Scanning a full table changes nothing until replacement is confirmed.
- Replacement moves the chosen player to the sideline.
- Single remove, clear table, and clear all preserve participants and sideline invariants.

### Scorekeeping

- Focused and normal table views calculate identical scores for every fan value and win type.
- Both views require four current occupants before recording a result.
- Double-tapping/retrying a save creates only one game.
- A successful result updates Points, Skill, analytics, game logs, and table activity exactly as the normal UI does.

### Synchronization and cleanup

- Two phones checking in simultaneously cannot overwrite one another or create a fifth seat.
- Normal Session Manager changes appear in focused views and vice versa.
- After two hours without a game, a non-empty table is cleared within the Cron interval and occupants appear on the sideline.
- Lazy cleanup produces the same result when Cron has not run.

### Mobile and accessibility

- The focused view works at 320 px width without horizontal scrolling.
- All primary touch targets are at least 44×44 px.
- Controls remain reachable above iOS Safari browser chrome and safe areas.
- Every icon-only control has an accessible name.
- Loading, saving, full-table, offline, invalid-code, and error states are announced and understandable without color alone.

## 16. Required tests

Unit tests:

- QR signature generation, validation, rotation, and timing-safe mismatch behavior;
- session normalization and table extension;
- check-in/move/full/replacement algorithms;
- participant/sideline invariants;
- pure scoring parity with existing rules;
- inactivity deadline calculation.

Database/integration tests:

- one-player QR session creation;
- advisory-lock concurrency with five simultaneous check-ins to one table;
- simultaneous move of one player to two tables;
- unique self-player linking race;
- revision conflict handling;
- game transaction updates `last_game_at` only on success;
- stale cleanup is idempotent.

Component tests:

- signed-out, identity, linked, full, and invalid QR states;
- add-player bottom sheet statuses;
- mobile result workflow;
- clear/remove confirmations;
- focus icon link from the normal table card.

End-to-end manual matrix:

- iPhone Safari, Android Chrome, and desktop Chrome;
- fresh Google account and returning account;
- no session, existing session, full table, stale table, rotated code;
- two or more real phones operating the same table concurrently.

## 17. Non-goals for the first release

- Anonymous scorekeeping without Google sign-in.
- Native camera scanning inside the app; users use their phone camera.
- Paid dynamic-QR analytics.
- Browser Fullscreen API.
- Offline queued game submission.
- Removing players from the roster through the focused view.
- Editing or deleting historical games through the focused view.
- Automatically closing an otherwise active club session after table cleanup.

## 18. Definition of done

The feature is done when permanent printed table codes can be used by first-time and returning users to reach a synchronized, mobile-focused table; seating remains correct under concurrent phones; scoring is identical to the existing Session Manager; inactive tables clear safely; the normal club UI can enter the same focused view; and no paid QR or scheduling service is required.
