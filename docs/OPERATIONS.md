# Production operations

This app uses free-tier GitHub Actions, Vercel Hobby, Firebase Authentication, and Supabase PostgreSQL. The procedures below protect production data without assuming paid point-in-time recovery.

## Pipeline overview

| File | Trigger | Purpose |
| --- | --- | --- |
| `.github/workflows/deploy.yml` | Pull request, `main`, manual | Secret scan, lint, tests, build, then gated Vercel production deployment from `main` |
| `.github/workflows/database-backup.yml` | Daily at 06:17 UTC, manual | Validated, encrypted `public` schema backup retained for 14 days |
| `.github/workflows/database-migrate.yml` | Manual | Encrypted pre-migration backup, then ordered migrations |
| `.github/dependabot.yml` | Weekly | npm and GitHub Actions update pull requests |

Vercel's Git integration can continue producing pull-request previews. Preview environment variables must use fabricated values or a non-production backend; never make `MIGRATION_DATABASE_URL` available to Preview. Disable Vercel's automatic production deployment after the Actions deployment is verified, otherwise a merge can produce two production deployments.

## One-time GitHub setup

Create a GitHub environment named `production-deploy`. Add a required reviewer and prevent administrators from bypassing it. Store these as environment secrets:

- `VERCEL_TOKEN`: a Vercel access token.
- `VERCEL_ORG_ID`: from the linked project's `.vercel/project.json`.
- `VERCEL_PROJECT_ID`: from the linked project's `.vercel/project.json`.

Create `production-database` with a required reviewer and store `MIGRATION_DATABASE_URL` there. Create `database-backup` without required reviewers so its scheduled job can run unattended, and store `MIGRATION_DATABASE_URL` there too. The duplicate is intentional: backup jobs get no deployment authority, deployment jobs get no database-owner credential, and migrations require approval. Add `BACKUP_AGE_RECIPIENT` as a repository variable because it is a public encryption recipient, not a secret.

During the transition, workflows accept `SUPABASE_DATABASE_URL` when `MIGRATION_DATABASE_URL` is absent. Remove that fallback secret after the split setup is working.

Generate an age identity on a trusted computer and keep the private file in a password manager or offline storage:

```bash
age-keygen -o mahjong-backup-key.txt
```

Copy only the printed `age1...` public recipient into the repository variable named `BACKUP_AGE_RECIPIENT`. Never upload `mahjong-backup-key.txt` to GitHub, Vercel, Supabase, or the repository.

In branch protection for `main`:

1. Require a pull request before merging.
2. Require the `Quality gates` status check.
3. Require branches to be up to date.
4. Require conversation resolution.
5. Block force pushes and branch deletion.
6. Apply the rule to administrators.

In Actions settings, keep the default workflow token read-only and require actions to be pinned to full commit SHAs. Dependabot will propose updates to those pins.

## Vercel configuration

The production Vercel project needs the application variables from `.env.example`. Configure `APP_DATABASE_URL`, not `MIGRATION_DATABASE_URL`, in Vercel Production. The owner-level migration credential must exist only in the GitHub production environment and trusted local administration environments.

After adding `VERCEL_TOKEN`, `VERCEL_ORG_ID`, and `VERCEL_PROJECT_ID`, manually run `CI and production deploy`. Verify the smoke test and production URL before disabling Vercel's automatic production deployment. Keep Git preview deployments enabled if their environment is isolated from production data.

## Least-privilege runtime database role

Migration `0007` must be applied before configuring the runtime role. In the Supabase SQL editor, run `supabase/operations/configure_app_runtime_role.sql`, then run this separately with a generated password that is not stored in shell history or source control:

```sql
alter role app_runtime password '<GENERATED PASSWORD>';
```

Build a session-pooler connection string for `app_runtime`, verify it with `select current_user`, and set it as Vercel Production's `APP_DATABASE_URL`. The role can perform application DML and bypass browser-oriented RLS for trusted server operations, but it cannot create, alter, drop, or truncate tables and cannot access `game_audit_log` directly.

Keep the old `SUPABASE_DATABASE_URL` configured until a production smoke test succeeds with `APP_DATABASE_URL`. Then remove it from Vercel. Retain the owner connection only as `MIGRATION_DATABASE_URL` in GitHub's protected production environment.

When a migration adds a table that the server must access, explicitly grant only the required DML privileges to `app_runtime` in that migration. Do not grant it schema ownership or blanket DDL privileges.

## Backups

The daily workflow uses PostgreSQL 17 `pg_dump` custom format for the `public` schema, validates the archive with `pg_restore --list`, encrypts it with the age public key, creates a SHA-256 checksum, and uploads only encrypted files. Firebase remains the identity provider, and this app does not store application files in Supabase Storage, so the `public` database schema is the recovery scope.

Run the workflow manually after an important club event if losing the time since the previous nightly backup would be unacceptable. Download one encrypted artifact monthly to separate local or external storage. GitHub automatically disables scheduled workflows on public repositories after 60 days without repository activity, so check the most recent successful backup periodically.

## Restore drill and recovery

Test a restore after initial setup and at least quarterly. A backup that has never been restored is not proven.

1. Download the `.age` file and matching checksum from the workflow artifact.
2. Verify `sha256sum -c <file>.sha256`.
3. Decrypt locally:

   ```bash
   age --decrypt -i mahjong-backup-key.txt -o backup.dump supabase-....dump.age
   ```

4. Restore into a disposable local PostgreSQL/Supabase database, never production first:

   ```bash
   pg_restore --no-owner --no-privileges --dbname="$TEST_DATABASE_URL" backup.dump
   ```

5. Verify club, player, game, and game-entry counts; open the app against the restored database; and verify recent game statistics.
6. Delete the decrypted archive after the drill. Retain the encrypted artifact.

For an incident:

1. Stop or disable production writes.
2. Create and preserve a backup of the damaged database.
3. Inspect `game_audit_log` for a small accidental update or delete; prefer reconstructing only the affected rows.
4. Otherwise restore the last known-good archive into a disposable database and validate it.
5. Restore selected data or replace production only after validation.
6. Apply any migrations newer than the restored snapshot, rebuild derived statistics, smoke test, then resume writes.

The daily schedule has a worst-case recovery point of roughly 24 hours. The audit log narrows that gap for game edits and deletions but is not a replacement for off-site backups.

## Migration procedure

Create migrations as new ordered files; never edit an already-applied file. Prefer backward-compatible expand/deploy/contract changes.

1. Merge and deploy code that tolerates both the old and expanded schema when required.
2. Open `Production database migration` in Actions and choose `Run workflow`.
3. Enter `MIGRATE` and a specific reason.
4. Confirm the encrypted pre-migration artifact uploaded successfully.
5. Verify the migration output and run the production deployment/smoke test.

Do not run the production integration test against live data. It writes rows inside a transaction and expects existing club fixtures. Unit CI intentionally receives no production secrets.
