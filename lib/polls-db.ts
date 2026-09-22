// Server-only DB layer for one-tap polls. Self-healing raw tables (same pattern as
// NewsPost — CREATE TABLE IF NOT EXISTS at runtime, no migration needed). The vote
// ledger is append-only: every vote carries a `voterRef` that is either a device
// token (anonymous) or a user id (claimed), so the anonymous→registered transition
// is a re-parent, never a table migration (PRD §4). Server-only (never imported by
// the "use client" PollCard) — it uses prisma + node crypto.
import { randomUUID, createHash } from "crypto";
import { prisma } from "@/lib/prisma";
import { authCutoverFrozen } from "@/lib/shared-auth/mode";
import { OPTION_KEYS, ZERO_COUNTS, type OptionKey, type PollSeed, type PollState, type PollCounts, type TimeBucket } from "@/lib/polls";

let tablesReady = false;

export async function ensurePollTables() {
  if (authCutoverFrozen()) return;
  if (tablesReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "Poll" (
      "slug"       TEXT PRIMARY KEY,
      "question"   TEXT NOT NULL,
      "questionEs" TEXT,
      "optionA"    TEXT NOT NULL DEFAULT 'Yes',
      "optionB"    TEXT NOT NULL DEFAULT 'No',
      "optionAEs"  TEXT,
      "optionBEs"  TEXT,
      "daebakUrl"  TEXT,
      "policy"     TEXT NOT NULL DEFAULT 'anonymous_allowed',
      "closeAt"    TIMESTAMP,
      "createdAt"  TIMESTAMP NOT NULL DEFAULT now()
    )`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PollVote" (
      "id"        TEXT PRIMARY KEY,
      "pollSlug"  TEXT NOT NULL,
      "option"    TEXT NOT NULL,
      "voterRef"  TEXT NOT NULL,
      "voterType" TEXT NOT NULL DEFAULT 'device',
      "ipHash"    TEXT,
      "source"    TEXT,
      "flags"     TEXT,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now()
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PollVote_poll_voter_idx"   ON "PollVote" ("pollSlug","voterRef")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PollVote_poll_created_idx" ON "PollVote" ("pollSlug","createdAt")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PollVote_ip_created_idx"   ON "PollVote" ("ipHash","createdAt")`);
  // Polls grew from A/B to up to four options; the extra labels are added
  // additively so existing two-option polls keep working with them left NULL.
  for (const col of ["optionC", "optionCEs", "optionD", "optionDEs"]) {
    await prisma.$executeRawUnsafe(`ALTER TABLE "Poll" ADD COLUMN IF NOT EXISTS "${col}" TEXT`);
  }
  tablesReady = true;
}

// Upsert the poll row from its config seed (labels/daebak may be edited in config).
export async function seedPoll(s: PollSeed) {
  if (authCutoverFrozen()) return;
  const label = (k: OptionKey) => s.options.find((o) => o.key === k)?.label ?? null;
  const labelEs = (k: OptionKey) => s.options.find((o) => o.key === k)?.labelEs ?? null;
  await prisma.$executeRaw`
    INSERT INTO "Poll" ("slug","question","questionEs","optionA","optionB","optionAEs","optionBEs","optionC","optionCEs","optionD","optionDEs","daebakUrl","closeAt")
    VALUES (${s.slug}, ${s.question}, ${s.questionEs},
            ${label("a") ?? "Yes"}, ${label("b") ?? "No"}, ${labelEs("a")}, ${labelEs("b")},
            ${label("c")}, ${labelEs("c")}, ${label("d")}, ${labelEs("d")},
            ${s.daebakUrl ?? null}, ${s.closeAt ? new Date(s.closeAt) : null})
    ON CONFLICT ("slug") DO UPDATE SET
      "question"   = EXCLUDED."question",
      "questionEs" = EXCLUDED."questionEs",
      "optionA"    = EXCLUDED."optionA",
      "optionB"    = EXCLUDED."optionB",
      "optionAEs"  = EXCLUDED."optionAEs",
      "optionBEs"  = EXCLUDED."optionBEs",
      "optionC"    = EXCLUDED."optionC",
      "optionCEs"  = EXCLUDED."optionCEs",
      "optionD"    = EXCLUDED."optionD",
      "optionDEs"  = EXCLUDED."optionDEs",
      "daebakUrl"  = EXCLUDED."daebakUrl",
      "closeAt"    = EXCLUDED."closeAt"`;
}

// Display counts include bot-flagged votes (per PRD §5.4) but exclude re-parent
// duplicates (flagged 'dup'), which are not real second votes.
export async function getCounts(slug: string): Promise<PollCounts> {
  const rows = await prisma.$queryRaw<{ option: string; c: number }[]>`
    SELECT "option", COUNT(*)::int AS c FROM "PollVote"
    WHERE "pollSlug" = ${slug} AND ("flags" IS NULL OR "flags" NOT LIKE '%dup%')
    GROUP BY "option"`;
  const counts: PollCounts = { ...ZERO_COUNTS };
  for (const r of rows) {
    const k = r.option as OptionKey;
    if (OPTION_KEYS.includes(k)) counts[k] = Number(r.c);
  }
  counts.total = OPTION_KEYS.reduce((n, k) => n + counts[k], 0);
  return counts;
}

export async function getMyVote(slug: string, voterRef: string): Promise<OptionKey | null> {
  const rows = await prisma.$queryRaw<{ option: string }[]>`
    SELECT "option" FROM "PollVote"
    WHERE "pollSlug" = ${slug} AND "voterRef" = ${voterRef} AND ("flags" IS NULL OR "flags" NOT LIKE '%dup%')
    ORDER BY "createdAt" ASC LIMIT 1`;
  const o = rows[0]?.option as OptionKey | undefined;
  return o && OPTION_KEYS.includes(o) ? o : null;
}

type Poll = { slug: string; policy: string; closeAt: Date | null };
async function getPoll(slug: string): Promise<Poll | null> {
  const rows = await prisma.$queryRaw<Poll[]>`SELECT "slug","policy","closeAt" FROM "Poll" WHERE "slug" = ${slug} LIMIT 1`;
  return rows[0] ?? null;
}

// Assemble the full state the poll UI needs. `userId` set → the caller is claimed
// (voterRef = userId); else fall back to the device token if we have one.
export async function getPollState(
  seed: PollSeed,
  opts: { userId?: string | null; voterName?: string | null; deviceToken?: string | null },
): Promise<PollState> {
  await ensurePollTables();
  await seedPoll(seed);
  const poll = await getPoll(seed.slug);
  const voterRef = opts.userId ?? opts.deviceToken ?? null;
  const [counts, myVote] = await Promise.all([
    getCounts(seed.slug),
    voterRef ? getMyVote(seed.slug, voterRef) : Promise.resolve<OptionKey | null>(null),
  ]);
  const closeAt = poll?.closeAt ?? null;
  return {
    slug: seed.slug,
    question: seed.question, questionEs: seed.questionEs,
    options: seed.options,
    daebakUrl: seed.daebakUrl,
    counts, myVote,
    closed: !!closeAt && closeAt.getTime() < Date.now(),
    policy: (poll?.policy as PollState["policy"]) ?? "anonymous_allowed",
    voterName: opts.userId ? (opts.voterName ?? null) : null,
  };
}

// Idempotent per (poll, voterRef): a repeat vote returns the original pick rather
// than double-counting — webview retries and double-taps are safe.
export async function castVote(
  slug: string, option: OptionKey,
  ctx: { voterRef: string; voterType: "device" | "profile"; ipHash?: string | null; source?: string | null; flags?: string | null },
): Promise<OptionKey> {
  await ensurePollTables();
  const existing = await getMyVote(slug, ctx.voterRef);
  if (existing) return existing;
  await prisma.$executeRaw`
    INSERT INTO "PollVote" ("id","pollSlug","option","voterRef","voterType","ipHash","source","flags")
    VALUES (${randomUUID()}, ${slug}, ${option}, ${ctx.voterRef}, ${ctx.voterType}, ${ctx.ipHash ?? null}, ${ctx.source ?? null}, ${ctx.flags ?? null})`;
  return option;
}

export async function getTimeseries(slug: string): Promise<TimeBucket[]> {
  await ensurePollTables();
  const rows = await prisma.$queryRaw<{ t: Date; option: string; c: number }[]>`
    SELECT date_trunc('hour', "createdAt") AS t, "option", COUNT(*)::int AS c FROM "PollVote"
    WHERE "pollSlug" = ${slug} AND ("flags" IS NULL OR "flags" NOT LIKE '%dup%')
    GROUP BY 1, 2 ORDER BY 1 ASC`;
  const buckets = new Map<string, TimeBucket>();
  for (const r of rows) {
    const key = new Date(r.t).toISOString();
    const bucket = buckets.get(key) ?? { t: key, a: 0, b: 0, c: 0, d: 0 };
    const k = r.option as OptionKey;
    if (OPTION_KEYS.includes(k)) bucket[k] = Number(r.c);
    buckets.set(key, bucket);
  }
  return [...buckets.values()];
}

// Claim re-parenting (PRD §5.3): attach this device's votes to the profile. For
// polls where the profile already voted, the device vote is a duplicate — keep the
// profile's, flag the device one 'dup' (excluded from counts). Idempotent.
export async function reparentDeviceVotes(deviceToken: string, userId: string): Promise<void> {
  if (!deviceToken || deviceToken === userId) return;
  await ensurePollTables();
  await prisma.$executeRaw`
    UPDATE "PollVote" d SET "voterRef" = ${userId}, "voterType" = 'profile'
    WHERE d."voterRef" = ${deviceToken} AND d."voterType" = 'device'
      AND NOT EXISTS (SELECT 1 FROM "PollVote" u WHERE u."pollSlug" = d."pollSlug" AND u."voterRef" = ${userId})`;
  // Any device votes left are conflicts (profile already voted that poll) → flag
  // once (guard keeps this idempotent across repeated GETs — no flag-string growth).
  await prisma.$executeRaw`
    UPDATE "PollVote" SET "flags" = trim(COALESCE("flags", '') || ' dup')
    WHERE "voterRef" = ${deviceToken} AND "voterType" = 'device' AND ("flags" IS NULL OR "flags" NOT LIKE '%dup%')`;
}

// Loose per-IP rate limit — shared mobile-carrier IPs are common, so this only
// deters casual flooding; real integrity is measured, not blocked (PRD §5.4).
export async function checkIpRate(ipHash: string | null): Promise<boolean> {
  if (!ipHash) return true;
  const rows = await prisma.$queryRaw<{ c: number }[]>`
    SELECT COUNT(*)::int AS c FROM "PollVote" WHERE "ipHash" = ${ipHash} AND "createdAt" > now() - interval '1 minute'`;
  return Number(rows[0]?.c ?? 0) < 30;
}

export function newDeviceToken(): string {
  return "d_" + randomUUID();
}

export function hashIp(ip: string | null | undefined): string | null {
  if (!ip) return null;
  return createHash("sha256").update(`${ip}:${process.env.AUTH_SECRET ?? "aegyo-salt"}`).digest("hex").slice(0, 32);
}
