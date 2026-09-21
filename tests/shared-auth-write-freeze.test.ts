import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import {
  CUTOVER_GET_WRITER_PATHS,
  shouldBlockForAuthCutover,
} from "../lib/shared-auth/write-freeze";

const originalFreeze = process.env.AEGYO_AUTH_CUTOVER_FREEZE;

afterEach(() => {
  if (originalFreeze === undefined) delete process.env.AEGYO_AUTH_CUTOVER_FREEZE;
  else process.env.AEGYO_AUTH_CUTOVER_FREEZE = originalFreeze;
});

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory()
      ? routeFiles(path)
      : entry.name === "route.ts"
        ? [path]
        : [];
  });
}

function auditedWrites() {
  const apiRoot = join(process.cwd(), "app", "api");
  return routeFiles(apiRoot).flatMap((file) => {
    const source = readFileSync(file, "utf8");
    const methods = ["POST", "PUT", "PATCH", "DELETE"].filter((method) =>
      new RegExp(`export (?:async function|const) ${method}\\b`).test(source),
    );
    const route =
      "/api/" +
      relative(apiRoot, file)
        .split(sep)
        .slice(0, -1)
        .map((part) => (part.startsWith("[") ? "test-value" : part))
        .join("/");
    return methods.map((method) => ({ method, pathname: route }));
  });
}

describe("site write freeze during shared-auth cutover", () => {
  it("keeps the reviewed GET-writer inventory explicit and fully blocked", () => {
    expect(CUTOVER_GET_WRITER_PATHS).toEqual([
      "/api/admin/annotations",
      "/api/admin/digest",
      "/api/admin/event-registrations",
      "/api/admin/event-registrations/sync",
      "/api/admin/giveaway-entries",
      "/api/admin/i18n",
      "/api/admin/lyrics",
      "/api/admin/pc-artist-index",
      "/api/admin/pc-index",
      "/api/admin/poll-results",
      "/api/admin/slang-media",
      "/api/auth/shared/callback",
      "/api/events/register",
      "/api/follow",
      "/api/giveaway",
      "/api/le-sserafim",
      "/api/polls/[slug]",
      "/api/polls/[slug]/timeseries",
      "/api/restock-alert",
      "/api/tips",
      "/api/vote",
    ]);
    for (const pathname of CUTOVER_GET_WRITER_PATHS) {
      const routeFile = join(
        process.cwd(),
        "app",
        ...pathname.slice(1).split("/"),
        "route.ts",
      );
      expect(existsSync(routeFile), pathname).toBe(true);
      expect(readFileSync(routeFile, "utf8"), pathname).toMatch(
        /export (?:async function|const) GET\b/,
      );
      expect(
        shouldBlockForAuthCutover(
          { method: "GET", pathname: pathname.replace("[slug]", "monthly") },
          { AEGYO_AUTH_CUTOVER_FREEZE: "true" },
        ),
        pathname,
      ).toBe(true);
    }

    process.env.AEGYO_AUTH_CUTOVER_FREEZE = "true";
    for (const pattern of CUTOVER_GET_WRITER_PATHS) {
      const pathname = pattern.replace("[slug]", "monthly");
      expect(
        middleware(new NextRequest(`https://aegyo.example.test${pathname}`))
          .status,
        pattern,
      ).toBe(503);
    }
  });

  it("covers every current API mutation before its route handler runs", () => {
    const writes = auditedWrites();
    expect(writes.length).toBeGreaterThan(30);
    expect(writes).toContainEqual({
      method: "POST",
      pathname: "/api/events/register",
    });

    const uncovered = writes.filter(
      (request) =>
        request.pathname !== "/api/auth/logout" &&
        !shouldBlockForAuthCutover(request, {
          AEGYO_AUTH_CUTOVER_FREEZE: "true",
        }),
    );
    expect(uncovered).toEqual([]);
  });

  it("returns a retryable no-store response for event registration", async () => {
    process.env.AEGYO_AUTH_CUTOVER_FREEZE = "true";
    const response = middleware(
      new NextRequest("https://aegyo.example.test/api/events/register", {
        method: "POST",
        body: JSON.stringify({ email: "fan@example.test" }),
      }),
    );

    expect(response.status).toBe(503);
    expect(response.headers.get("retry-after")).toBe("60");
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("set-cookie")).toBeNull();
    await expect(response.json()).resolves.toMatchObject({
      code: "cutover_freeze",
    });
  });

  it("keeps pure API reads, logout, and every request without the freeze unchanged", () => {
    expect(
      shouldBlockForAuthCutover(
        { method: "GET", pathname: "/api/news" },
        { AEGYO_AUTH_CUTOVER_FREEZE: "true" },
      ),
    ).toBe(false);
    expect(
      shouldBlockForAuthCutover(
        { method: "POST", pathname: "/api/auth/logout" },
        { AEGYO_AUTH_CUTOVER_FREEZE: "true" },
      ),
    ).toBe(false);
    expect(
      shouldBlockForAuthCutover(
        { method: "POST", pathname: "/api/events/register" },
        {},
      ),
    ).toBe(false);

    process.env.AEGYO_AUTH_CUTOVER_FREEZE = "true";
    const readResponse = middleware(
      new NextRequest(
        "https://aegyo.example.test/api/news?artist=aespa",
      ),
    );
    expect(readResponse.headers.get("x-middleware-next")).toBe("1");
    expect(readResponse.headers.get("set-cookie")).toBeNull();

    delete process.env.AEGYO_AUTH_CUTOVER_FREEZE;
    const unfrozenWrite = middleware(
      new NextRequest("https://aegyo.example.test/api/events/register", {
        method: "POST",
      }),
    );
    expect(unfrozenWrite.headers.get("x-middleware-next")).toBe("1");
    expect(unfrozenWrite.headers.get("set-cookie")).toBeNull();
  });
});
