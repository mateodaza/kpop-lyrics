import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  mode: vi.fn(),
  redirect: vi.fn(),
}));

vi.mock("../lib/shared-auth/mode", () => ({ resolveAuthMode: mocks.mode }));
vi.mock("next/navigation", () => ({ redirect: mocks.redirect }));

import { enterSharedAuthWhenActive } from "../lib/shared-auth/entry-page";

beforeEach(() => vi.clearAllMocks());

describe("legacy auth entry pages", () => {
  it("redirects directly into Accounts when shared auth is active", async () => {
    mocks.mode.mockResolvedValue({ kind: "shared", config: {} });
    await enterSharedAuthWhenActive();
    expect(mocks.redirect).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledWith("/api/auth/shared/login");
  });

  it.each([
    { kind: "legacy" },
    { kind: "closed", reason: "cutover_freeze" },
  ])("does not bypass the $kind mode", async (mode) => {
    mocks.mode.mockResolvedValue(mode);
    await enterSharedAuthWhenActive();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });
});
