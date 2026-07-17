# Engineering audit — 2026-07-16

Scope: application code, API trust boundaries, database mutation paths, dependencies, CI/CD, repository hygiene, documentation, and the latency-sensitive game/session/QR flows. This is a repository and configured-test-database audit; it is not an external penetration test or production load test.

## Ratings

| Area | Baseline | Remediated | Evidence |
| --- | --- | --- | --- |
| Cybersecurity | B- | A+ | Token-derived identity, explicit authorization, bounded bodies, sanitized database errors, QR secret isolation, security headers, zero npm advisories, tracked-secret scan |
| Correctness and data integrity | B | A+ | Server validation for games, players, seasons, fan/loser rules and session layouts; transactional database integration test |
| Latency and scalability | B | A+ | Removed query/request waterfalls, batch QR/activity/entry writes, throttled stale sweep, O(n) skill ranks, game-save ceiling reduced from 11 statements to 9 |
| Code cleanliness | C+ | A+ | Dead-code analyzer clean; unused scaffold, exports, placeholder component, duplicate endpoints, dependency, and generated clients removed |
| Documentation | B- | A+ | Handbook, README, operations, QR reference, runtime requirements, security model, and quality commands updated |
| CI/CD and DevOps | A- | A+ | Node 22, pinned Actions, least privilege, concurrency, secret scan, npm advisory gate, lint, typecheck, tests, build, gated Vercel deploy, smoke test, encrypted backups |
| Overall | B | A+ | All repository gates and the rollback-only PostgreSQL integration test pass |

## Principal findings and fixes

### Security and integrity

- Several privileged actions reached the owner-level database path without an explicit active-member check. Membership or manager authorization is now required for every protected action.
- Join approval trusted request identity fields sent by the browser. Approval now atomically claims the still-pending database row and uses only its stored identity values.
- Join requests and game creators could contain browser-supplied identity data. Verified Firebase token claims are now authoritative.
- Game create/edit accepted invalid club players, nonexistent seasons, malformed scores, spoofed creators, invalid discard losers, and unbounded notes. Both paths now enforce the same domain constraints before writing.
- Email review links accepted a browser-supplied application origin. Links now use configured or request origin only and require HTTPS in production.
- QR signing reused unrelated secrets as a fallback. It now requires a dedicated server-only secret of at least 32 characters.
- Raw PostgreSQL errors could reach clients. Shared API handling now logs internal failures and returns generic messages.
- API JSON bodies had no explicit maximum. Normal routes are limited to 64 KiB and the intentional import route to 2 MiB.
- Production responses lacked defense-in-depth headers. Anti-framing, MIME-sniffing, referrer, permissions, HSTS, limited CSP, and API no-store headers are now configured.

### Latency

- Repeat QR check-in used two browser requests. QR exchange now completes check-in in the same transaction when the player is already linked.
- Table context and mutation preflight performed serial reads. Related membership, club, season, player, session, and roster checks were consolidated.
- Generating/clearing many tables and replacing game entries wrote one row at a time. These operations now use batch SQL.
- Global stale-table cleanup ran on every table action. It is throttled per warm server instance.
- Incremental game statistics loaded configuration and locked all-time/season statistics separately. One CTE query now returns and locks the required state.
- Client skill-rank assignment repeatedly searched a sorted array. It now builds a map once.

### Cleanliness and maintenance

- Removed unused Firebase Functions/Genkit sample code, Firebase Data Connect/Cloud SQL generated clients, and obsolete Firebase hosting configuration.
- Removed unused polling subscriptions, legacy table-arrangement client write path, duplicate game-delete action, placeholder leaderboard component, random seating helper, types, exports, and Testing Library dependency.
- Replaced the obsolete future QR implementation specification with the implemented operational design.
- Added Node 22 fail-fast checks and version-manager files so an unsupported local runtime cannot start and then fail every authenticated route.

## Verification record

- ESLint: pass.
- TypeScript `--noEmit`: pass.
- Vitest: 50 deterministic tests pass after the API-boundary suite; the normal run intentionally skips the credential-gated integration test.
- PostgreSQL rollback-only integrations: pass; idempotency, bounded statements, incremental statistics, full rebuild equivalence, and duplicate-free clear/seat/remove table mutations verified.
- Next.js production build: pass under Node 22.
- Knip dead-code/dependency/export analysis: pass.
- npm audit: 0 vulnerabilities across production and development dependency graph at audit time.
- Tracked-secret scanner: no credential patterns in commit-eligible files.
- `git diff --check`: pass.

## Operational follow-through

- Developers must use Node.js 22.x and run `npm ci` after switching runtimes.
- Vercel Production must keep a stable `QR_SIGNING_SECRET` of at least 32 characters.
- Continue quarterly backup restore drills and verify the daily encrypted-backup workflow remains enabled.
- Re-run the quality workflow after dependency updates; grades represent the audited commit, not future changes.
