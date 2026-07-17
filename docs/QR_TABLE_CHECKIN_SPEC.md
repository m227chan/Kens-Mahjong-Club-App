# QR table check-in: implemented design and operations

Status: implemented. This file is the current operational reference, not a future specification.

## User flow

Each printed code identifies one physical club table. A signed-in member who scans it is resolved to their linked roster player and seated transactionally. If the user is not yet a member, the club's manager-controlled QR enrollment setting either enrolls them as a regular member or creates a pending join request. An unlinked member can link an available player or create a self-linked player before continuing.

The focused route at `/check-in/[publicId]` supports mobile scoring for that table. The normal Session Manager uses the same transactional mutation service, so simultaneous phones cannot overwrite the complete session layout.

Managers can print the active session's table codes from `/club/[clubId]/session/qr-print`. Codes use SVG error correction level Q, a four-module quiet zone, and require no paid QR provider or stored image assets.

## Trust boundaries

- Firebase Admin verifies every bearer token before a QR or table action.
- The URL fragment contains the HMAC signature so it is not sent in ordinary HTTP referrer headers.
- `QR_SIGNING_SECRET` is server-only and must contain at least 32 characters. It has no fallback to another credential.
- Signatures cover the club, table number, token version, and random public ID and are compared in constant time.
- Public IDs and signatures are syntax-validated before database access.
- The database, not the browser, decides membership, player linkage, table capacity, and current occupancy.
- QR enrollment can create only a regular membership, never a manager.
- Rotating a table's code increments its token version and invalidates old prints.
- Request bodies are size-limited and database errors are not returned to clients.

## Concurrency and latency

`lib/server/table-checkin.ts` is the single write path for check-in, seating, removal, and clearing. Mutations run in PostgreSQL transactions and lock the active session row before updating its layout. The service enforces one table per player and four seats per table.

The hot paths intentionally avoid request and query waterfalls:

- repeat scans can exchange the QR and check in through one browser request;
- context loads combine membership, club, session, and roster data;
- check-in preflight combines membership, season, linked-player, and requested-player checks;
- clearing all tables records activity in one batch;
- printing all table codes creates missing rows in one `unnest` upsert;
- stale-table cleanup is throttled to one sweep per server instance per minute.

## Relevant files

| Area | Files |
| --- | --- |
| QR generation and settings | `app/api/table-qr/route.ts`, `lib/qr-signing.ts` |
| Check-in and table mutations | `app/api/table-checkin/route.ts`, `lib/server/table-checkin.ts` |
| Client flow | `app/check-in/[publicId]/page.tsx`, `lib/table-checkin-client.ts` |
| Focused scoring | `app/club/[clubId]/session/table/[tableNumber]/page.tsx` |
| Printing | `app/club/[clubId]/session/qr-print/page.tsx` |
| Database model | `supabase/migrations/0006_qr_table_checkin.sql` |
| Tests | `__tests__/table-scoring.test.ts`, `__tests__/session-layout.test.ts` |

## Operating checklist

1. Set one stable, randomly generated `QR_SIGNING_SECRET` in local and Vercel Production environments. Do not prefix it with `NEXT_PUBLIC_`.
2. Set `NEXT_PUBLIC_APP_URL` to the canonical HTTPS production origin before printing codes.
3. Apply migration `0006_qr_table_checkin.sql` through the protected migration workflow.
4. Print and scan every code after first setup and after any rotation.
5. Keep automatic enrollment off when possession of a printed code should not grant regular membership.
6. Rotate and reprint a code if its URL is shared outside the intended club.

The full system architecture, authorization model, and production recovery procedures are documented in `DOCUMENTATION.md` and `docs/OPERATIONS.md`.
