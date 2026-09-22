// Server-only DB layer for the PC Index. Self-healing raw tables (same pattern as
// NewsPost / Poll) so no migration is needed. A card's listings are a snapshot:
// each ingest replaces that card's listing set, so re-ingesting is idempotent and
// the sold rows carry the price history.
import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { authCutoverFrozen } from "@/lib/shared-auth/mode";
import type { PcCardSeed as CardSeed, PcListing as Listing } from "@/lib/pc-index";

let tablesReady = false;

export async function ensurePcTables() {
  if (authCutoverFrozen()) return;
  if (tablesReady) return;
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PcCard" (
      "sku"       TEXT PRIMARY KEY,
      "name"      TEXT NOT NULL,
      "performer" TEXT,
      "grp"       TEXT,
      "era"       TEXT,
      "tier"      INTEGER NOT NULL DEFAULT 1,
      "imageUrl"  TEXT,
      "isBundle"  BOOLEAN NOT NULL DEFAULT false,
      "sortOrder" INTEGER NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now()
    )`);
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "PcListing" (
      "id"          TEXT PRIMARY KEY,
      "cardSku"     TEXT NOT NULL,
      "marketplace" TEXT,
      "url"         TEXT,
      "price"       DOUBLE PRECISION NOT NULL,
      "currency"    TEXT NOT NULL DEFAULT 'USD',
      "origPrice"   DOUBLE PRECISION,
      "origCurrency" TEXT,
      "listingType" TEXT NOT NULL DEFAULT 'secondary',
      "status"      TEXT NOT NULL DEFAULT 'active',
      "soldDate"    DATE,
      "note"        TEXT,
      "capturedAt"  TIMESTAMP NOT NULL DEFAULT now()
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "PcListing_card_idx" ON "PcListing" ("cardSku")`);
  tablesReady = true;
}

// Ingest a batch of cards + their listings. Upserts the card, then replaces that
// card's listings with the provided snapshot (idempotent).
export async function ingestCards(cards: CardSeed[]): Promise<{ cards: number; listings: number }> {
  await ensurePcTables();
  let nc = 0, nl = 0;
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (!c?.sku || !c?.name) continue;
    await prisma.$executeRaw`
      INSERT INTO "PcCard" ("sku","name","performer","grp","era","tier","imageUrl","isBundle","sortOrder")
      VALUES (${c.sku}, ${c.name}, ${c.performer ?? null}, ${c.group ?? null}, ${c.era ?? null},
              ${Number(c.tier) || 1}, ${c.imageUrl ?? null}, ${!!c.isBundle}, ${i})
      ON CONFLICT ("sku") DO UPDATE SET
        "name" = EXCLUDED."name", "performer" = EXCLUDED."performer", "grp" = EXCLUDED."grp",
        "era" = EXCLUDED."era", "tier" = EXCLUDED."tier",
        "imageUrl" = COALESCE(EXCLUDED."imageUrl", "PcCard"."imageUrl"),
        "isBundle" = EXCLUDED."isBundle", "sortOrder" = EXCLUDED."sortOrder"`;
    nc++;
    await prisma.$executeRaw`DELETE FROM "PcListing" WHERE "cardSku" = ${c.sku}`;
    for (const l of c.listings ?? []) {
      const price = Number(l.price);
      if (!isFinite(price) || price <= 0) continue;
      const soldDate = l.status === "sold" && l.soldDate ? new Date(l.soldDate) : null;
      await prisma.$executeRaw`
        INSERT INTO "PcListing" ("id","cardSku","marketplace","url","price","currency","origPrice","origCurrency","listingType","status","soldDate","note")
        VALUES (${randomUUID()}, ${c.sku}, ${l.marketplace ?? null}, ${l.url ?? null}, ${price},
                ${l.currency ?? "USD"}, ${l.origPrice ?? null}, ${l.origCurrency ?? null},
                ${l.listingType === "primary" ? "primary" : "secondary"},
                ${l.status === "sold" ? "sold" : "active"}, ${soldDate}, ${l.note ?? null})`;
      nl++;
    }
  }
  return { cards: nc, listings: nl };
}

type CardRow = { sku: string; name: string; performer: string | null; grp: string | null; era: string | null; tier: number; imageUrl: string | null; isBundle: boolean };
type ListingRow = { marketplace: string | null; url: string | null; price: number; currency: string; origPrice: number | null; origCurrency: string | null; listingType: string; status: string; soldDate: Date | null; note: string | null };

export type PcCardFull = {
  sku: string; name: string; performer: string | null; group: string | null; era: string | null;
  tier: number; imageUrl: string | null; isBundle: boolean; listings: Listing[];
};

export async function getAllCardsWithListings(): Promise<PcCardFull[]> {
  await ensurePcTables();
  const cards = await prisma.$queryRaw<CardRow[]>`
    SELECT "sku","name","performer","grp","era","tier","imageUrl","isBundle"
    FROM "PcCard" ORDER BY "sortOrder" ASC, "createdAt" ASC`;
  const out: PcCardFull[] = [];
  for (const c of cards) {
    const rows = await prisma.$queryRaw<ListingRow[]>`
      SELECT "marketplace","url","price","currency","origPrice","origCurrency","listingType","status","soldDate","note"
      FROM "PcListing" WHERE "cardSku" = ${c.sku}
      ORDER BY ("status" = 'sold') DESC, "soldDate" ASC NULLS LAST, "price" ASC`;
    out.push({
      sku: c.sku, name: c.name, performer: c.performer, group: c.grp, era: c.era,
      tier: Number(c.tier), imageUrl: c.imageUrl, isBundle: c.isBundle,
      listings: rows.map((r): Listing => ({
        marketplace: r.marketplace ?? "", url: r.url, price: Number(r.price), currency: r.currency,
        origPrice: r.origPrice != null ? Number(r.origPrice) : null, origCurrency: r.origCurrency,
        listingType: r.listingType === "primary" ? "primary" : "secondary",
        status: r.status === "sold" ? "sold" : "active",
        soldDate: r.soldDate ? new Date(r.soldDate).toISOString().slice(0, 10) : null,
        note: r.note,
      })),
    });
  }
  return out;
}
