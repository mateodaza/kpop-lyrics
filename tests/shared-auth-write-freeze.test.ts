import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { shouldBlockForAuthCutover } from "../lib/shared-auth/write-freeze";

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

  it("keeps API reads, logout, and every request without the freeze unchanged", () => {
    expect(
      shouldBlockForAuthCutover(
        { method: "GET", pathname: "/api/events/register" },
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
        "https://aegyo.example.test/api/events/register?slug=event",
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
