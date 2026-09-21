# Shared Accounts adapter

Authentication mode depends on both `AEGYO_SHARED_AUTH_ENABLED` and the durable database latch. Before activation, flag-off preserves the existing login, signup, password reset, cookie, session, role, and user-data behavior. Flag-on remains unavailable until the latch exists and configuration is valid. After activation, only valid flag-on shared auth works; flag-off or invalid configuration fails closed and never reactivates legacy passwords or sessions.

## Provider contract

Register this confidential OIDC client with Accounts:

- redirect URI: `${AEGYO_APP_ORIGIN}/api/auth/shared/callback`
- authorization code flow with S256 PKCE
- scopes: `openid profile email`
- client authentication: `client_secret_basic`
- signed ID-token claims: `sid`, `auth_time`, `https://aegyoarena.com/claims/password-reset-state`, `https://aegyoarena.com/claims/security-version`, and `https://aegyoarena.com/claims/operator-cutoff`

Set `AEGYO_AUTH_BASE_URL`, `AEGYO_APP_ORIGIN`, `AEGYO_AUTH_CLIENT_ID`, `AEGYO_AUTH_CLIENT_SECRET`, `AEGYO_AUTH_TRANSACTION_SECRET` (at least 32 characters), and the separate `AEGYO_AUTH_STATE_READER_KEY`. Accounts must expose authenticated `POST /api/internal/session-state` with the contract used by Arcade.

## Provider request and retry boundary

Discovery, token, JWKS and authenticated session-state requests use same-origin HTTPS only, reject redirects, time out after five seconds and cap streamed responses at one MiB. Discovery also rejects authorization/token/JWKS endpoints outside the configured Accounts origin. Failed discovery is evicted; a changed client secret uses a new configuration cache entry.

The callback converts only the maintained OIDC client's `auth_time` timestamp failure into the one permitted interactive `max_age=0` retry. Expired tokens and other verification failures do not take that path; a failed retry cannot loop or mint a local session. Session reuse preserves the five-second forward clock-skew allowance while keeping reset and operator cutoffs strict. Security-state responses must match the requested subject and provider session ID.

September 12 validation: the shared-auth test suite and explicit TypeScript check passed under Node 24.21.0. Network tests use controlled responses with the real OIDC discovery client; callback tests isolate application persistence. They do not replace the real three-origin browser acceptance gate. The installed Next 15 package has no bundled `dist/docs`; route conventions were checked against the [official route-handler reference](https://nextjs.org/docs/app/api-reference/file-conventions/route).

## Migration and mapping gate

Apply `prisma/migrations/20260911200000_add_shared_auth/migration.sql` through a separate reviewed migration step before enabling the flag. The current Railway build and start overrides do not run `prisma migrate deploy`, so application deployment must not be treated as migration evidence. Verify the migration record and empty latch directly after the explicit step. The migration adds `SharedAuthIdentity`, nullable provider metadata to `Session`, and an initially empty `AuthCutoverLatch`. Existing local user IDs, roles, relations, hashes, and session rows remain intact.

Import existing-user mappings explicitly with stable local IDs before cutover. Each row contains a local `userId`, the exact issuer (`${AEGYO_AUTH_BASE_URL}/api/auth`), and Accounts `subject`. Both `userId` and `(issuer, subject)` are unique. Reconcile and review conflicts before insertion.

After cutover, an unmapped, cryptographically verified provider identity may create a new local user only when its signed `email_verified` claim is `true` and its signed email is usable. The user and `(issuer, subject)` mapping are created atomically. Provisioning stores `EXTERNAL_PASSWORD_SENTINEL` in `passwordHash`; normal password hashing cannot produce it. It does not call Beehiiv or subscribe/reactivate the address. If the normalized email already exists locally, the callback returns `existing_account_needs_support` with plain recovery guidance and changes nothing. Email is only a collision guard and profile value; it never establishes ownership or links an existing user. Concurrent callbacks converge on the mapping that won the unique `(issuer, subject)` constraint, while a different-subject email race fails closed.

Rehearse those races through the real Prisma adapter against a disposable PostgreSQL 18 container:

```sh
npm run auth:provisioning-postgres-proof
```

The runner ignores any existing `DATABASE_URL`, publishes a random PostgreSQL port on loopback only, applies the additive migration to a synthetic baseline, and removes the container on exit. It proves same-identity convergence, different-subject email exclusion, two valid sessions for two successful callbacks, and preservation of a mixed-case legacy email/hash/role without creating a mapping.

### Local reconciliation rehearsal

Run the source-only validator with five local JSON paths:

```sh
npm run auth:reconcile -- local-before.json accounts-subjects.json mapping.json local-after.json reviewed-manifest.json
```

The tool has no database or network client. It requires:

- a version-1 local snapshot containing every stable `User.id`, its raw `User.role`, and sorted linked record IDs grouped by table;
- a version-1 Accounts snapshot containing the exact issuer and opaque `public.user.id` values emitted as OIDC `sub`;
- explicit version-1 pairs `{localUserId, subject}` prepared through a reviewed import journal; and
- a second local snapshot taken after the rehearsal.

Email fields are rejected at every input depth. Accounts currently has no dedicated legacy source-ID field, so the tool never assumes equal IDs and cannot derive a pair. A real import needs either an external reviewed journal recording created Accounts IDs or a reviewed additive Accounts source-identity table.

The local snapshot must cover Prisma-owned `Favorite`, `Comment`, and `SuggestedEdit` IDs plus runtime-owned records keyed by the user, including `SlangVote`, profile `PollVote`, and `Follow`, when those tables exist. The before/after digest fails if a user ID, raw role, or linked record owner changes. `reviewed-manifest.json` is created with mode `0600` and exclusive-create semantics. Its `mappingDigest` is SHA-256 over canonical JSON of the manifest core, excluding the digest field itself; use that exact lowercase 64-hex value for latch activation.

### Mapping installation and activation

Create the ignored private directory with `mkdir -m 700 .proof`, then keep the reviewed manifest inside it with mode `0600`. The operator CLI rejects the ordinary `DATABASE_URL`; supply a dedicated `AEGYO_MAPPING_DATABASE_URL`, its exact `AEGYO_MAPPING_DATABASE_NAME`, the bare `AEGYO_AUTH_BASE_URL`, `AEGYO_MAPPING_MANIFEST`, and `AEGYO_MAPPING_APPROVED_DIGEST`.

First install mappings without activating shared auth:

```sh
AEGYO_MAPPING_CONFIRM=install-reviewed-mappings-without-latch npm run auth:install-mappings -- apply
npm run auth:install-mappings -- status
```

`apply` recomputes the canonical digest, requires the exact `${AEGYO_AUTH_BASE_URL}/api/auth` issuer, and compares the complete current `User.id` and raw `role` population with the manifest by keyed identity rather than database collation order. It locks users and mappings, refuses existing remaps, subject collisions, missing or extra users, and inserts only exact missing `(issuer, subject) -> User.id` rows in one transaction. An identical retry writes nothing new. After activation it is verification-only and refuses missing mappings instead of repairing them. If the client loses the commit acknowledgement, keep the freeze in place and use `status`; do not infer rollback. `status` uses a repeatable-read transaction for a consistent database snapshot, but it does not establish the external writer freeze.

After the separate ownership reconciliation passes, activate the latch explicitly:

```sh
AEGYO_MAPPING_CONFIRM=activate-reviewed-shared-auth-cutover \
npm run auth:install-mappings -- activate
npm run auth:install-mappings -- status
```

`activate` refuses to run unless the live process has both `AEGYO_SHARED_AUTH_ENABLED=true` and `AEGYO_AUTH_CUTOVER_FREEZE=true`. Set both on the deployed service before running activation and inherit them into the operator process; do not supply temporary command-only overrides. The freeze wins while the latch is absent, so this ordering cannot expose a half-cut-over login path. Activation rechecks complete mapping coverage before inserting the latch. An existing latch succeeds only when its digest exactly matches; it never uses a blind conflict-ignore. The operator must keep every legacy writer frozen throughout mapping, reconciliation, and activation. The database ID/role check does not replace the before/after linked-record reconciliation for favorites, profiles, comments, votes, follows, or other history.

While `AEGYO_AUTH_CUTOVER_FREEZE=true`, middleware rejects every mutating API request and every reviewed GET handler that can write or call a provider with a no-store `503` and `Retry-After: 60`, before route code can cause side effects. Pure API reads and page reads remain available; lazy community, poll, and photocard-index setup/seed helpers become read-only during the freeze. Local logout is the sole mutation-method exception: its closed-mode path only expires the browser cookie and does not mutate the database. The legacy login, signup, and recovery pages show a temporary retry message instead of credential forms.

Deploy and verify the freeze before taking the first preservation snapshot. After the freeze deployment is healthy, wait at least 35 seconds (never less than 30 seconds) before snapshotting: `lib/viewcount.ts` can hold pre-freeze view increments for a 30-second buffered flush, and a retiring application instance may still commit that batch. Keep the freeze enabled through mapping verification and latch activation.

### Production-schema rehearsal

A schema-only production dump can be rehearsed without copying any production rows:

```sh
npm run auth:production-schema-proof -- /absolute/path/to/schema-only.sql
```

The runner requires an explicit absolute file, rejects dumps containing `COPY`, `INSERT`, database creation, or database switching, and never reads `DATABASE_URL`. It streams the schema through stdin into a uniquely named PostgreSQL 18 container with `--network none`, no host mounts, bounded startup, and cleanup on exit. The committed synthetic fixture then exercises actual non-null/default columns and verifies stable user IDs, 64-hex password hashes, raw role, `is_owner`, profile/reward fields, legacy sessions, favorites, points, follows, explicit issuer/subject mappings, migration checksum journaling, latch digest constraints, and rejected latch update/delete/truncate operations.

This is a production-schema rehearsal with synthetic data, not a production-data restore. Keep the schema dump and generated manifests private and ignored. The historical checked-in SQLite-style migration chain remains untouched; the restored catalog and migration history still require operator review before applying the additive migration to any remote database.

### Synthetic backup/restore and activation rehearsal

Run the executable end-to-end local rehearsal with its explicit synthetic-data confirmation:

```sh
AEGYO_SYNTHETIC_RESTORE_CONFIRM=disposable-synthetic-backup-restore \
  npm run auth:backup-restore-proof
```

The runner refuses inherited database URLs, creates a uniquely named PostgreSQL 18 container whose random port is bound only to loopback, and removes its private `.proof` workspace and container on every exit. It creates synthetic legacy users, profiles, password hashes, sessions, a reset, every linked-record category used by reconciliation, an event registration and a community annotation. It takes an actual custom-format `pg_dump`, restores it into a new database, and compares a canonical database-derived snapshot of every original column in every fixture table before backup and after activation. It applies the exact additive migration and invokes the real reconciliation and mapping operator CLIs through apply, status and separate activation. A separate database-derived ownership snapshot proves IDs, roles and linked ownership remain unchanged. A second restored database contains a conflicting mapping and proves the real apply command fails without inserting another mapping or latch.

This proves the Aegyo backup/restore and mapping side with synthetic data only. It does not copy Accounts users, establish the external writer freeze, exercise email or authorize any remote database. During a real rehearsal the freeze must span the final source snapshot, Accounts import, mapping apply/status, activation and final ownership snapshot because activation itself verifies user IDs, roles and exact mappings but does not recompute linked-record digests.

## Cutover and recovery

Before activation, prove the mappings, register the exact callback, verify provider-state reader credentials, freeze legacy credential writes operationally, and rehearse the forced sign-in UX. Activation keeps old rows for audit and data integrity, but legacy sessions lack provider metadata and are never authorized afterward. They are not a rollback mechanism.

With shared mode active, direct visits to `/login`, `/signup`, and `/forgot-password` enter Accounts before rendering a legacy credential form. Legacy login, signup, forgot, and reset endpoints also stop before credential reads or writes; their clients follow the Accounts redirect if cutover occurs after a page has already loaded. `/api/auth/recovery` continues into Accounts sign-in, where Accounts owns password recovery and new-account registration. Aegyo creates a local row only on the verified callback under the provisioning rules above. Shared sessions retain the `session` cookie and `getSession()` shape expected by current consumers. Ordinary reads cache provider state for at most 30 seconds; authenticated writes always check Accounts and fail closed during outage.

The remaining rollout gates are provider client registration and secrets, a reconciled import of every existing-user mapping and digest, migration-history review, a real database concurrency rehearsal, real browser/signup/recovery rehearsal, and a final UX pass that labels Accounts sign-in and collision recovery directly.

## Irreversible activation latch

After every gate above passes, an operator runs this idempotent procedure with the lowercase SHA-256 digest of the reviewed mapping manifest:

```sql
INSERT INTO "AuthCutoverLatch" ("id", "mappingDigest")
VALUES ('accounts-shared-auth-v1', '<64-lowercase-hex-digest>')
ON CONFLICT ("id") DO NOTHING;
```

“Operator-only” describes the deployment procedure; this migration does not create or assign database roles. The application only reads the latch and exposes no create, update, delete, truncate, or reset route. Database constraints allow only the fixed ID and a 64-character lowercase hexadecimal digest. Triggers reject ordinary update, delete, and truncate statements. A privileged schema owner can deliberately remove or disable those DDL guards, so production database privileges and change review remain part of the control.

Before the row exists, flag-off uses legacy auth and flag-on stays unavailable. After it exists, valid flag-on configuration uses shared auth; flag-off, malformed configuration, and database lookup failure return a recoverable unavailable response. Never delete or alter the row, and never restore access through old hashes or legacy session rows.
