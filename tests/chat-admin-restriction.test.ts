import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  session: vi.fn(),
  role: vi.fn(),
  query: vi.fn(),
  findUser: vi.fn(),
  findMute: vi.fn(),
  upsertMute: vi.fn(),
  removeMessages: vi.fn(),
  createEvent: vi.fn(),
}));

vi.mock("../lib/chat-auth", () => ({ getChatSession: mocks.session }));
vi.mock("../lib/access", () => ({ getRole: mocks.role }));
vi.mock("../lib/chat-policy", () => ({ sameOrigin: () => true }));
vi.mock("../lib/prisma", () => ({ prisma: { $transaction: async (run: (tx: unknown) => Promise<unknown>) => run({
  $queryRaw: mocks.query,
  user: { findUnique: mocks.findUser },
  chatMute: { findUnique: mocks.findMute, upsert: mocks.upsertMute, deleteMany: vi.fn() },
  chatMessage: { updateMany: mocks.removeMessages },
  chatModerationEvent: { create: mocks.createEvent },
}) } }));

import { POST } from "../app/api/admin/chat/route";

function request(decision: string, reason: string) {
  return new NextRequest("https://aegyo.example.test/api/admin/chat", {
    method: "POST", headers: { origin: "https://aegyo.example.test", "content-type": "application/json" },
    body: JSON.stringify({ userId: "fan-id", decision, reason }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("AEGYO_CHAT_ENABLED", "true");
  mocks.session.mockResolvedValue({ userId: "admin-id", user: { email: "admin@example.test" } });
  mocks.role.mockResolvedValue("admin");
  mocks.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ role: "contributor" }]);
  mocks.findUser.mockResolvedValue({ id: "fan-id", email: "fan@example.test" });
  mocks.findMute.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

describe("chat account restriction", () => {
  it("blocks further access and removes both public and held messages", async () => {
    const response = await POST(request("restrict", "Credible underage report"));
    expect(response.status).toBe(200);
    expect(mocks.upsertMute).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ userId: "fan-id", reason: "Credible underage report", until: new Date("9999-12-31T00:00:00.000Z") }),
    }));
    expect(mocks.removeMessages).toHaveBeenCalledWith(expect.objectContaining({
      where: { authorId: "fan-id", status: { in: ["visible", "held"] } },
      data: expect.objectContaining({ status: "removed", moderationNote: "account_restricted" }),
    }));
    expect(mocks.createEvent).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ action: "restrict", userId: "fan-id" }) }));
  });

  it("does not let an ordinary moderator restrict a peer", async () => {
    mocks.role.mockResolvedValue("moderator");
    mocks.query.mockReset().mockResolvedValueOnce([]).mockResolvedValueOnce([{ role: "moderator" }]);
    const response = await POST(request("restrict", "test"));
    expect(response.status).toBe(403);
    expect(mocks.upsertMute).not.toHaveBeenCalled();
    expect(mocks.removeMessages).not.toHaveBeenCalled();
  });
});
