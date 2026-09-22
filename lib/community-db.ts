import { prisma } from "@/lib/prisma";
import { authCutoverFrozen } from "@/lib/shared-auth/mode";
import { generateCommunity, type PoolSong } from "@/lib/community";

// Self-contained community store (annotations + comments), created and seeded
// additively on first use. Never touches the existing Prisma-managed tables.

export type AnnRow = {
  id: string;
  authorSlug: string;
  authorName: string;
  songTitle: string;
  songSlug: string | null;
  lineIndex: number | null;
  word: string;
  romanization: string;
  note: string;
  status: "approved" | "rejected" | "pending";
  reviewedBy: string | null;
  reviewedAt: Date | null;
  createdAt: Date;
};

export type CommentRow = {
  id: string;
  authorSlug: string;
  authorName: string;
  context: string;
  body: string;
  createdAt: Date;
};

let ready = false;

function placeholders(rowIndex: number, cols: number): string {
  return "(" + Array.from({ length: cols }, (_, k) => `$${rowIndex * cols + k + 1}`).join(",") + ")";
}

async function createCommunityTables(): Promise<void> {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommunityAnnotation" (
      "id"           TEXT PRIMARY KEY,
      "authorSlug"   TEXT NOT NULL,
      "authorName"   TEXT NOT NULL,
      "songTitle"    TEXT NOT NULL,
      "word"         TEXT NOT NULL,
      "romanization" TEXT NOT NULL,
      "note"         TEXT NOT NULL,
      "status"       TEXT NOT NULL DEFAULT 'pending',
      "reviewedBy"   TEXT,
      "reviewedAt"   TIMESTAMP,
      "createdAt"    TIMESTAMP NOT NULL DEFAULT now()
    )`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "CommunityAnnotation" ADD COLUMN IF NOT EXISTS "songSlug" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "CommunityAnnotation" ADD COLUMN IF NOT EXISTS "lineIndex" INTEGER`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommunityAnnotation_author_idx" ON "CommunityAnnotation" ("authorSlug")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommunityAnnotation_status_idx" ON "CommunityAnnotation" ("status")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommunityAnnotation_songSlug_idx" ON "CommunityAnnotation" ("songSlug")`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "CommunityComment" (
      "id"         TEXT PRIMARY KEY,
      "authorSlug" TEXT NOT NULL,
      "authorName" TEXT NOT NULL,
      "context"    TEXT NOT NULL,
      "body"       TEXT NOT NULL,
      "createdAt"  TIMESTAMP NOT NULL DEFAULT now()
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "CommunityComment_author_idx" ON "CommunityComment" ("authorSlug")`);
}

// Pull a pool of real catalog songs to anchor seed annotations to actual song pages:
// the aespa comeback as the "trending" set everyone annotates, plus the most-viewed
// songs (with lyrics) for variety.
async function buildSongPool(): Promise<{ trending: PoolSong[]; popular: PoolSong[] }> {
  const trending = await prisma.$queryRawUnsafe<PoolSong[]>(
    `SELECT "title","slug" FROM "Song" WHERE "slug" LIKE 'aespa-%' AND COALESCE("lyricsKo",'') <> '' ORDER BY "viewCount" DESC, "slug" ASC LIMIT 80`,
  );
  const popular = await prisma.$queryRawUnsafe<PoolSong[]>(
    `SELECT "title","slug" FROM "Song" WHERE COALESCE("lyricsKo",'') <> '' AND "slug" NOT LIKE 'aespa-%' ORDER BY "viewCount" DESC, "slug" ASC LIMIT 160`,
  );
  return { trending, popular };
}

// Insert the deterministic showcase seed (annotations + comments), anchored to real
// songs. Idempotent via ON CONFLICT DO NOTHING, so it's safe to call repeatedly.
async function insertCommunitySeed(): Promise<{ annotations: number; comments: number }> {
    const { annotations, comments } = generateCommunity(await buildSongPool());
    const base = Date.now();

    // Seeded annotations are pre-moderated (~90% approved / ~10% rejected) — the
    // "cleared queue" end state. Real submissions arrive later as status='pending'.
    const aCols = 12;
    const aVals: unknown[] = [];
    const aTuples: string[] = [];
    annotations.forEach((a, idx) => {
      const createdAt = new Date(base - idx * 90 * 60 * 1000);
      const reviewedAt = new Date(createdAt.getTime() + 2 * 60 * 60 * 1000);
      aTuples.push(placeholders(idx, aCols));
      aVals.push(a.id, a.authorSlug, a.authorName, a.songTitle, a.songSlug, a.word, a.romanization, a.note, a.status, "Aegyo Moderation", reviewedAt, createdAt);
    });
    if (aTuples.length) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "CommunityAnnotation" ("id","authorSlug","authorName","songTitle","songSlug","word","romanization","note","status","reviewedBy","reviewedAt","createdAt") VALUES ${aTuples.join(",")} ON CONFLICT ("id") DO NOTHING`,
        ...aVals,
      );
    }

    const cCols = 6;
    const cVals: unknown[] = [];
    const cTuples: string[] = [];
    comments.forEach((m, idx) => {
      const createdAt = new Date(base - idx * 70 * 60 * 1000);
      cTuples.push(placeholders(idx, cCols));
      cVals.push(m.id, m.authorSlug, m.authorName, m.context, m.body, createdAt);
    });
    if (cTuples.length) {
      await prisma.$executeRawUnsafe(
        `INSERT INTO "CommunityComment" ("id","authorSlug","authorName","context","body","createdAt") VALUES ${cTuples.join(",")} ON CONFLICT ("id") DO NOTHING`,
        ...cVals,
      );
    }
  return { annotations: annotations.length, comments: comments.length };
}

export async function ensureCommunity(): Promise<void> {
  // Production tables are verified before cutover. During the freeze, page
  // reads must not run DDL or seed rows after the preservation snapshot.
  if (authCutoverFrozen()) return;
  if (ready) return;
  await createCommunityTables();
  const existing = await prisma.$queryRaw<{ c: number }[]>`SELECT COUNT(*)::int AS c FROM "CommunityAnnotation"`;
  if (Number(existing[0]?.c ?? 0) === 0) await insertCommunitySeed();
  ready = true;
}

// Rebuild the showcase seed after the contributor usernames/slugs change. Drops the
// generated rows but KEEPS real user submissions (createAnnotation ids start with "u-").
export async function reseedCommunity(): Promise<{ annotations: number; comments: number }> {
  await createCommunityTables();
  await prisma.$executeRawUnsafe(`DELETE FROM "CommunityAnnotation" WHERE "id" NOT LIKE 'u-%'`);
  await prisma.$executeRawUnsafe(`DELETE FROM "CommunityComment"`);
  const counts = await insertCommunitySeed();
  ready = true;
  return counts;
}

export async function getUserAnnotations(slug: string, limit = 5): Promise<AnnRow[]> {
  await ensureCommunity();
  return prisma.$queryRawUnsafe<AnnRow[]>(
    `SELECT * FROM "CommunityAnnotation" WHERE "authorSlug" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
    slug, limit,
  );
}

export async function getUserComments(slug: string, limit = 10): Promise<CommentRow[]> {
  await ensureCommunity();
  return prisma.$queryRawUnsafe<CommentRow[]>(
    `SELECT * FROM "CommunityComment" WHERE "authorSlug" = $1 ORDER BY "createdAt" DESC LIMIT $2`,
    slug, limit,
  );
}

export async function getAnnotation(id: string): Promise<AnnRow | null> {
  await ensureCommunity();
  const r = await prisma.$queryRawUnsafe<AnnRow[]>(`SELECT * FROM "CommunityAnnotation" WHERE "id" = $1 LIMIT 1`, id);
  return r[0] ?? null;
}

// Approved community annotations for a song page — matched by stored slug, or by title
// for real user submissions that only carried a title.
export async function getSongAnnotations(slug: string, title: string, limit = 24): Promise<AnnRow[]> {
  await ensureCommunity();
  return prisma.$queryRawUnsafe<AnnRow[]>(
    `SELECT * FROM "CommunityAnnotation"
     WHERE "status" = 'approved'
       AND ("songSlug" = $1 OR (("songSlug" IS NULL OR "songSlug" = '') AND lower("songTitle") = lower($2)))
     ORDER BY "createdAt" DESC LIMIT $3`,
    slug, title, limit,
  );
}

// Skill-facing: every community annotation for a song (any status) for auditing.
export async function getSongAnnotationsForAudit(slug: string, title: string): Promise<AnnRow[]> {
  await ensureCommunity();
  return prisma.$queryRawUnsafe<AnnRow[]>(
    `SELECT * FROM "CommunityAnnotation"
     WHERE "songSlug" = $1 OR (("songSlug" IS NULL OR "songSlug" = '') AND lower("songTitle") = lower($2))
     ORDER BY "createdAt" DESC`,
    slug, title,
  );
}

// Skill-facing: apply moderation decisions. Only provided fields change (COALESCE keeps
// the rest). Used by the annotation-moderation skill to set lineIndex/word/note/status.
export type ModerationItem = {
  id: string;
  lineIndex?: number | null;
  word?: string;
  romanization?: string;
  note?: string;
  status?: "approved" | "rejected" | "pending";
};
export async function applyModeration(items: ModerationItem[], reviewer = "annotation-moderation"): Promise<number> {
  await ensureCommunity();
  let n = 0;
  for (const it of items) {
    const id = String(it?.id ?? "").trim();
    if (!id) continue;
    const lineIndex = typeof it.lineIndex === "number" ? it.lineIndex : null;
    const word = typeof it.word === "string" ? it.word : null;
    const romanization = typeof it.romanization === "string" ? it.romanization : null;
    const note = typeof it.note === "string" ? it.note : null;
    const status = it.status === "approved" || it.status === "rejected" || it.status === "pending" ? it.status : null;
    await prisma.$executeRaw`
      UPDATE "CommunityAnnotation" SET
        "lineIndex"    = COALESCE(${lineIndex}::int, "lineIndex"),
        "word"         = COALESCE(${word}, "word"),
        "romanization" = COALESCE(${romanization}, "romanization"),
        "note"         = COALESCE(${note}, "note"),
        "status"       = COALESCE(${status}, "status"),
        "reviewedBy"   = ${reviewer},
        "reviewedAt"   = now()
      WHERE "id" = ${id}`;
    n++;
  }
  return n;
}

export async function getModerationQueue(): Promise<{ pending: AnnRow[]; recent: AnnRow[] }> {
  await ensureCommunity();
  const pending = await prisma.$queryRawUnsafe<AnnRow[]>(`SELECT * FROM "CommunityAnnotation" WHERE "status" = 'pending' ORDER BY "createdAt" ASC`);
  const recent = await prisma.$queryRawUnsafe<AnnRow[]>(`SELECT * FROM "CommunityAnnotation" WHERE "status" <> 'pending' ORDER BY "reviewedAt" DESC NULLS LAST LIMIT 40`);
  return { pending, recent };
}

export async function getModerationStats(): Promise<{ approved: number; rejected: number; pending: number; total: number }> {
  await ensureCommunity();
  const r = await prisma.$queryRawUnsafe<{ status: string; c: number }[]>(`SELECT "status", COUNT(*)::int AS c FROM "CommunityAnnotation" GROUP BY "status"`);
  const m: Record<string, number> = {};
  for (const row of r) m[row.status] = Number(row.c);
  const approved = m.approved ?? 0, rejected = m.rejected ?? 0, pending = m.pending ?? 0;
  return { approved, rejected, pending, total: approved + rejected + pending };
}

export async function moderate(id: string, decision: "approved" | "rejected", reviewer: string): Promise<void> {
  await ensureCommunity();
  await prisma.$executeRaw`UPDATE "CommunityAnnotation" SET "status" = ${decision}, "reviewedBy" = ${reviewer}, "reviewedAt" = now() WHERE "id" = ${id}`;
}

export async function createAnnotation(a: { authorSlug: string; authorName: string; songTitle: string; word: string; note: string }): Promise<string> {
  await ensureCommunity();
  const id = `u-${a.authorSlug}-${Date.now().toString(36)}`;
  await prisma.$executeRaw`
    INSERT INTO "CommunityAnnotation" ("id","authorSlug","authorName","songTitle","word","romanization","note","status")
    VALUES (${id}, ${a.authorSlug}, ${a.authorName}, ${a.songTitle}, ${a.word}, ${""}, ${a.note}, 'pending')`;
  return id;
}
