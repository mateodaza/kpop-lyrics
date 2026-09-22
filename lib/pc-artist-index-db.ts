// Server-only DB layer for the per-idol Idol Market Index. Self-healing raw table
// (same pattern as NewsPost / Poll / PcCard) — no migration. One row per idol,
// upserted by slug, so re-ingesting a refreshed snapshot is idempotent.
import { prisma } from "@/lib/prisma";
import { authCutoverFrozen } from "@/lib/shared-auth/mode";
import type { ArtistIndexRow } from "@/lib/pc-artist-index";

let ready = false;

export async function ensureArtistIndexTable() {
  if (authCutoverFrozen()) return;
  if (ready) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PcArtistIndex" (
      "slug"            TEXT PRIMARY KEY,
      "name"            TEXT NOT NULL,
      "grp"             TEXT,
      "groupSlug"       TEXT,
      "imageUrl"        TEXT,
      "topCardName"     TEXT,
      "topCardPrice"    DOUBLE PRECISION,
      "topCardUrl"      TEXT,
      "topCardMarket"   TEXT,
      "topBundleName"   TEXT,
      "topBundlePrice"  DOUBLE PRECISION,
      "topBundleUrl"    TEXT,
      "topBundleMarket" TEXT,
      "supplyEbay"       INTEGER,
      "supplyMeraki"     INTEGER,
      "supplyPocamarket" INTEGER,
      "supplyTopps"      INTEGER,
      "supplyOther"      INTEGER,
      "supplyOtherNote"  TEXT,
      "signal"          TEXT,
      "confidence"      TEXT,
      "sortOrder"       INTEGER NOT NULL DEFAULT 0,
      "updatedAt"       TIMESTAMP NOT NULL DEFAULT now()
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PcArtistIndex_group_idx" ON "PcArtistIndex" ("groupSlug")`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "PcArtistIndex" ADD COLUMN IF NOT EXISTS "topCardImage" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "PcArtistIndex" ADD COLUMN IF NOT EXISTS "topBundleImage" TEXT`);
  await prisma.$executeRawUnsafe(`ALTER TABLE "PcArtistIndex" ADD COLUMN IF NOT EXISTS "shareOfVoice" INTEGER`);
  ready = true;
}

export type ArtistIndexIn = Partial<ArtistIndexRow> & { slug: string; name: string };

const intOrNull = (v: unknown): number | null => {
  const n = Number(v);
  return isFinite(n) && v != null && v !== "" ? Math.round(n) : null;
};
const numOrNull = (v: unknown): number | null => {
  const n = Number(v);
  return isFinite(n) && v != null && v !== "" ? n : null;
};

export async function ingestArtistIndex(rows: ArtistIndexIn[]): Promise<number> {
  await ensureArtistIndexTable();
  let n = 0;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r?.slug || !r?.name) continue;
    const tc = r.topCard ?? {};
    const tb = r.topBundle ?? {};
    const s = (r.supply ?? {}) as Partial<ArtistIndexRow["supply"]>;
    await prisma.$executeRaw`
      INSERT INTO "PcArtistIndex" (
        "slug","name","grp","groupSlug","imageUrl",
        "topCardName","topCardPrice","topCardUrl","topCardMarket","topCardImage",
        "topBundleName","topBundlePrice","topBundleUrl","topBundleMarket","topBundleImage",
        "supplyEbay","supplyMeraki","supplyPocamarket","supplyTopps","supplyOther","supplyOtherNote",
        "signal","confidence","shareOfVoice","sortOrder","updatedAt")
      VALUES (
        ${r.slug}, ${r.name}, ${r.group ?? null}, ${r.groupSlug ?? null}, ${r.imageUrl ?? null},
        ${(tc as ArtistIndexRow["topCard"]).name ?? null}, ${numOrNull((tc as ArtistIndexRow["topCard"]).price)}, ${(tc as ArtistIndexRow["topCard"]).url ?? null}, ${(tc as ArtistIndexRow["topCard"]).marketplace ?? null}, ${(tc as ArtistIndexRow["topCard"]).image ?? null},
        ${(tb as ArtistIndexRow["topBundle"]).name ?? null}, ${numOrNull((tb as ArtistIndexRow["topBundle"]).price)}, ${(tb as ArtistIndexRow["topBundle"]).url ?? null}, ${(tb as ArtistIndexRow["topBundle"]).marketplace ?? null}, ${(tb as ArtistIndexRow["topBundle"]).image ?? null},
        ${intOrNull(s.ebay)}, ${intOrNull(s.meraki)}, ${intOrNull(s.pocamarket)}, ${intOrNull(s.topps)}, ${intOrNull(s.other)}, ${s.otherNote ?? null},
        ${r.signal ?? null}, ${r.confidence ?? null}, ${intOrNull(r.shareOfVoice)}, ${i}, now())
      ON CONFLICT ("slug") DO UPDATE SET
        "name" = EXCLUDED."name", "grp" = EXCLUDED."grp", "groupSlug" = EXCLUDED."groupSlug",
        "imageUrl" = COALESCE(EXCLUDED."imageUrl", "PcArtistIndex"."imageUrl"),
        "topCardName" = EXCLUDED."topCardName", "topCardPrice" = EXCLUDED."topCardPrice",
        "topCardUrl" = EXCLUDED."topCardUrl", "topCardMarket" = EXCLUDED."topCardMarket", "topCardImage" = EXCLUDED."topCardImage",
        "topBundleName" = EXCLUDED."topBundleName", "topBundlePrice" = EXCLUDED."topBundlePrice",
        "topBundleUrl" = EXCLUDED."topBundleUrl", "topBundleMarket" = EXCLUDED."topBundleMarket", "topBundleImage" = EXCLUDED."topBundleImage",
        "supplyEbay" = EXCLUDED."supplyEbay", "supplyMeraki" = EXCLUDED."supplyMeraki",
        "supplyPocamarket" = EXCLUDED."supplyPocamarket", "supplyTopps" = EXCLUDED."supplyTopps",
        "supplyOther" = EXCLUDED."supplyOther", "supplyOtherNote" = EXCLUDED."supplyOtherNote",
        "signal" = EXCLUDED."signal", "confidence" = EXCLUDED."confidence", "shareOfVoice" = EXCLUDED."shareOfVoice",
        "sortOrder" = EXCLUDED."sortOrder", "updatedAt" = now()`;
    n++;
  }
  return n;
}

type Row = {
  slug: string; name: string; grp: string | null; groupSlug: string | null; imageUrl: string | null;
  topCardName: string | null; topCardPrice: number | null; topCardUrl: string | null; topCardMarket: string | null; topCardImage: string | null;
  topBundleName: string | null; topBundlePrice: number | null; topBundleUrl: string | null; topBundleMarket: string | null; topBundleImage: string | null;
  supplyEbay: number | null; supplyMeraki: number | null; supplyPocamarket: number | null; supplyTopps: number | null; supplyOther: number | null; supplyOtherNote: string | null;
  signal: string | null; confidence: string | null; shareOfVoice: number | null;
};

export async function getArtistIndex(): Promise<ArtistIndexRow[]> {
  try {
    await ensureArtistIndexTable();
    const rows = await prisma.$queryRaw<Row[]>`
      SELECT * FROM "PcArtistIndex" ORDER BY "sortOrder" ASC, "name" ASC`;
    return rows.map((r): ArtistIndexRow => ({
      slug: r.slug, name: r.name, group: r.grp ?? "", groupSlug: r.groupSlug ?? "", imageUrl: r.imageUrl,
      topCard: { name: r.topCardName, price: r.topCardPrice != null ? Number(r.topCardPrice) : null, url: r.topCardUrl, marketplace: r.topCardMarket, image: r.topCardImage },
      topBundle: { name: r.topBundleName, price: r.topBundlePrice != null ? Number(r.topBundlePrice) : null, url: r.topBundleUrl, marketplace: r.topBundleMarket, image: r.topBundleImage },
      supply: {
        ebay: r.supplyEbay, meraki: r.supplyMeraki, pocamarket: r.supplyPocamarket,
        topps: r.supplyTopps, other: r.supplyOther, otherNote: r.supplyOtherNote,
      },
      signal: r.signal, confidence: r.confidence, shareOfVoice: r.shareOfVoice,
    }));
  } catch { return []; }
}
