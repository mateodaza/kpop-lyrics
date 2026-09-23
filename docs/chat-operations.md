# Fan chat operations

## Deployment prerequisites

1. Merge the shared Aegyo Accounts cutover first. The API requires a provider-backed shared session for posts, reports, and chat moderation. Legacy local sessions remain read-only. Test a mapped legacy user: their local `emailVerified` flag may still be false despite a valid shared-account session.
2. Review and apply `scripts/chat/additive-schema.sql` to the Aegyo PostgreSQL database in a controlled release. `prisma migrate deploy` is currently blocked by the repository's preexisting SQLite migration lock versus PostgreSQL datasource mismatch. The SQL runs in one transaction and rejects a partial or preexisting chat schema. No Arcade code or database is involved.
3. Set `OPENAI_API_KEY` for OpenAI's `omni-moderation-latest` endpoint. Without it, reads continue but posts return 503. The classifier's own failure also returns 503 without publishing.
4. Set a high-entropy `CHAT_CLEANUP_SECRET` and arrange a daily POST to `/api/chat/cleanup` with `Authorization: Bearer <secret>`. Alert on non-2xx responses. The cleanup removes ordinary visible/removed messages after 30 days, held/reported messages after 90 days, and posting-attempt metadata after one day.
5. Have a moderator check `/admin/chat` daily. Classifier-flagged messages are private until approved. Two independent reports hide a visible message automatically. A moderator can approve or remove it. Review actions record reviewer ID and time.
6. Verify site routes at mobile and desktop widths, anonymous reading, shared-account posting, report flow, moderator review, and privacy copy in staging before production deployment.

## Limits and privacy

- Text only, 2–500 characters; links, contact details, and repeated spam are rejected before classification.
- Per account: one posting attempt per 8 seconds, 8 per 5 minutes, 60 per day. An authenticated reporter can file five reports per day and one report per message. Limits use database transactions and advisory locks across app instances.
- Chat tables hold local user IDs, display content, report reason codes, and review data. They do not copy email addresses or IP addresses. The classifier receives only message text.
- The read endpoint returns at most 60 recent visible messages and is polled every 15 seconds while the browser tab is visible. It does not claim an online-user count.
- If the safety provider has an outage, posting pauses. Operators should monitor 503s and never bypass screening to restore activity.
