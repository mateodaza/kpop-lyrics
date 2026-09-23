# Simon's Aegyo Arena fan chatbox

## Codebase review

- `app/layout.tsx` is the site-wide shell. A single client widget mounted there reaches every route without changing individual pages.
- The current site uses Next.js 15, PostgreSQL, Prisma, and the dark sakura design tokens in `app/globals.css`; the chat should inherit those tokens. The supplied Trollbox image is a reference for a dense, readable message list and compact presence header, not for its green branding or an unverified online count.
- Shared Aegyo Accounts is live. Chat posting uses a sensitive shared-session read; local password sessions stay read-only. Mapped legacy users may retain `emailVerified = false`, so that local flag is not a valid gate for shared accounts.
- `lib/access.ts` and `lib/roles.ts` already gate moderator tools. Reuse them for chat review; keep Arcade untouched.
- Existing community comments have no moderation or rate limit. Chat requires its own tables and server-side controls.

## Build

1. Add `ChatMessage`, `ChatReport`, and `ChatPostAttempt` Prisma models plus a reviewed additive PostgreSQL SQL change. The repository's existing migration lock is SQLite while its Prisma datasource is PostgreSQL, so `prisma migrate deploy` cannot apply this feature safely. Store body, author ID, visibility state, timestamps, moderation reason, and review metadata. Never store IP addresses or email copies in chat tables.
2. Add public, bounded newest-message reads (polling, no persistent connection). Show a count of new messages since the panel was last opened, not a fabricated online count. Visitors can read. Posting and reporting require a session.
3. On posting, normalize and bound text, reject links and deterministic spam, then call OpenAI's `omni-moderation-latest` endpoint. If the key, request, or response is unavailable, return a temporary failure and publish nothing. Flagged content enters the private review queue; only unflagged content becomes public. Recheck database-backed per-user limits in a transaction so concurrent requests cannot bypass them.
4. Let signed-in users report a visible message once. Reports immediately hide it pending moderator review at a small threshold. Give moderators a `/admin/chat` queue to approve or remove messages. Audit review actor and time.
5. Mount a compact 54px collapsed launcher on mobile, borrowing the low-footprint shape from Simon's PR #13. Do not show message text while collapsed on mobile. Expansion opens an accessible room; desktop uses a bottom-right panel. Provide loading, empty, rate-limit, moderation, and sign-in states.
6. Retain ordinary messages for 30 days and reported or held messages for 90 days, subject to user confirmation. Add a protected cleanup endpoint and document the required daily schedule. Keep only report reason codes and review metadata; do not send author email to the classifier.

## Verification and release gate

- Unit tests for normalization, spam checks, and moderation fail-closed behavior; API-level checks for auth and concurrent limits where a test database is available.
- Run TypeScript and production build without executing production migrations or deploying.
- Inspect mobile and desktop render once, fix defects in one pass, and confirm once.
- Before production: configure `OPENAI_API_KEY` and `CHAT_CLEANUP_SECRET`, schedule daily cleanup, review/apply `scripts/chat/additive-schema.sql` to the correct PostgreSQL catalog, and verify shared-account posting in preview, including a mapped legacy user. Keep `AEGYO_CHAT_ENABLED=false` on Railway until the production launch gate passes.

## Reconciliation with Simon's PR #13

This branch remains the canonical chat implementation. Simon's PR contributed the compact mobile launcher treatment; the shared Aegyo Accounts sign-in, existing Aegyo roles, and private moderation queue remain the authority. Do not merge Simon's email-code signup or its bulk `emailVerified` update: both would bypass the shared-account cutover and strand mapped users whose legacy local verification flag is false. Reactions, claimed online presence, and per-request runtime DDL are outside this first release. One upstream PR should supersede both drafts after the Vercel preview is reviewed.
