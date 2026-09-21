import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  frozen: vi.fn(),
  execute: vi.fn(),
}));

vi.mock("../lib/shared-auth/mode", () => ({
  authCutoverFrozen: mocks.frozen,
}));
vi.mock("../lib/prisma", () => ({
  prisma: { $executeRawUnsafe: mocks.execute },
}));

import { ensureCommunity } from "../lib/community-db";
import { ensurePollTables, seedPoll } from "../lib/polls-db";
import { ensurePcTables } from "../lib/pc-index-db";
import { ensureArtistIndexTable } from "../lib/pc-artist-index-db";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.frozen.mockReturnValue(true);
});

describe("read-page helpers during the cutover freeze", () => {
  it("does not run lazy DDL or poll seed writes", async () => {
    await ensureCommunity();
    await ensurePollTables();
    await seedPoll({
      slug: "proof",
      question: "Proof?",
      questionEs: "¿Prueba?",
      options: [
        { key: "a", label: "Yes", labelEs: "Sí" },
        { key: "b", label: "No", labelEs: "No" },
      ],
    });
    await ensurePcTables();
    await ensureArtistIndexTable();

    expect(mocks.execute).not.toHaveBeenCalled();
  });
});
