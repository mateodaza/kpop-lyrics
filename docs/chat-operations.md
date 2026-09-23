# Fan chat operations

## Deployment prerequisites

1. The shared Aegyo Accounts cutover is already live. The API requires a provider-backed shared session for posts, reports, and chat moderation. Legacy local sessions remain read-only. Test a mapped legacy user: their local `emailVerified` flag may still be false despite a valid shared-account session.
2. Review and apply `scripts/chat/additive-schema.sql` to the Aegyo PostgreSQL database in a controlled release. `prisma migrate deploy` is currently blocked by the repository's preexisting SQLite migration lock versus PostgreSQL datasource mismatch. The SQL runs in one transaction and rejects a partial or preexisting chat schema. No Arcade code or database is involved.
   Apply `scripts/chat/add-participation-schema.sql` after the base chat schema. It adds the per-account, versioned chat agreement used by the posting API.
3. Set `OPENAI_API_KEY` for OpenAI's `omni-moderation-latest` endpoint. Without it, reads continue but posts return 503. The classifier's own failure also returns 503 without publishing. Use a restricted project key with only Moderations write access. The classifier receives message text alone.
4. Set a high-entropy `CHAT_CLEANUP_SECRET` on the Aegyo service and the `aegyo-chat-cleanup` Railway Function. The function runs `scripts/chat/cleanup-cron.ts` daily and posts to `CHAT_CLEANUP_URL`; alert on failed runs. The cleanup removes ordinary visible/removed messages after 30 days, held/reported messages after 90 days, and posting-attempt metadata after one day. Switch `CHAT_CLEANUP_URL` from the preview to the live Aegyo origin after the PR merges, before removing the preview service.
5. Have a moderator check `/admin/chat` daily. Classifier-flagged messages are private until approved. Two independent reports hide a visible message automatically. A moderator can approve or remove it. Review actions record reviewer ID and time.
6. Verify site routes at mobile and desktop widths, anonymous reading, first-post age/rules acceptance, shared-account posting, report flow, moderator review, and privacy copy in the dedicated Railway preview service before production deployment. The compact widget links to `/chat` for the full room; both use the same API and moderation queue.
7. Set `AEGYO_CHAT_ENABLED=true` only on the Railway preview service until all launch checks pass. The flag defaults off for the live `kpop-lyrics` service. The preview service uses `Dockerfile.staging`, which builds without running migrations or seeds.

## Limits and privacy

- Text only, 2–500 characters; links, contact details, and repeated spam are rejected before classification.
- Posting requires acceptance of Fan Chat Terms version `2026-09-23` and a self-declaration of age 16 or older. The server checks the current version on every post. Existing accounts see the same one-time gate; reading remains public. No birth date is collected for chat.
- Per account: one accepted/pending posting attempt per 8 seconds, 8 per 5 minutes, 60 per day, plus at most 3 moderation-outage retries per 5 minutes. Site-wide caps are 120 attempts per minute and 500 per 5 minutes. An authenticated reporter can file five reports per day and one report per message. Limits use database transactions and advisory locks across app instances.
- Moderators can hide/approve messages and apply 24-hour chat mutes; each action is recorded as an append-only moderation event. They cannot mute themselves or an equal/higher role.
- Chat tables hold local user IDs, display content, report reason codes, and review data. They do not copy email addresses or IP addresses. The classifier receives only message text.
- The read endpoint returns at most 60 recent visible messages and is polled every 15 seconds while the browser tab is visible. It does not claim an online-user count.
- If the safety provider has an outage, posting pauses. Operators should monitor 503s and never bypass screening to restore activity.
