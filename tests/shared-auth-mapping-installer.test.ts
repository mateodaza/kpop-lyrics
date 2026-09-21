import { describe, expect, it, vi } from "vitest";
import { sha256 } from "../scripts/shared-auth/reconciliation-lib.mjs";
import {
  activateMappings,
  exactIssuer,
  requireSafeActivationEnvironment,
  validateReviewedManifest,
} from "../scripts/shared-auth/mapping-installer-lib.mjs";

function manifest() {
  const core = {
    version: 1,
    issuer: "https://accounts.example.test/api/auth",
    localSnapshotDigest: "a".repeat(64),
    accountsSubjectsDigest: "b".repeat(64),
    rows: [
      {
        localUserId: "local-1",
        issuer: "https://accounts.example.test/api/auth",
        subject: "subject-1",
        role: "moderator",
        linkedRecordsDigest: "c".repeat(64),
      },
    ],
  };
  return { ...core, mappingDigest: sha256(core) };
}

describe("reviewed mapping installer input", () => {
  it("requires both the live shared-auth flag and cutover freeze for activation", () => {
    expect(() => requireSafeActivationEnvironment({})).toThrow(
      "shared_auth_flag_not_enabled",
    );
    expect(() =>
      requireSafeActivationEnvironment({ AEGYO_SHARED_AUTH_ENABLED: "true" }),
    ).toThrow("cutover_freeze_not_enabled");
    expect(() =>
      requireSafeActivationEnvironment({
        AEGYO_SHARED_AUTH_ENABLED: "true",
        AEGYO_AUTH_CUTOVER_FREEZE: "true",
      }),
    ).not.toThrow();
  });

  it("refuses activation before opening a database transaction", async () => {
    const prisma = { $transaction: vi.fn() };
    const reviewed = manifest();
    await expect(
      activateMappings(prisma, reviewed, {
        AEGYO_SHARED_AUTH_ENABLED: "true",
        AEGYO_AUTH_CUTOVER_FREEZE: "false",
      }),
    ).rejects.toThrow("cutover_freeze_not_enabled");
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("derives the exact Accounts issuer from a canonical HTTPS origin", () => {
    expect(exactIssuer("https://accounts.example.test")).toBe(
      "https://accounts.example.test/api/auth",
    );
    for (const invalid of [
      "http://accounts.example.test",
      "https://accounts.example.test/path",
      "https://accounts.example.test?query=1",
    ])
      expect(() => exactIssuer(invalid)).toThrow("invalid_app_auth_base_url");
  });

  it("requires the approved canonical digest and exact issuer on every row", () => {
    const approved = manifest();
    expect(
      validateReviewedManifest(
        approved,
        approved.mappingDigest,
        approved.issuer,
      ),
    ).toBe(approved);
    expect(() =>
      validateReviewedManifest(
        { ...approved, accountsSubjectsDigest: "d".repeat(64) },
        approved.mappingDigest,
        approved.issuer,
      ),
    ).toThrow("manifest_digest_mismatch");
    const wrongIssuerCore = {
      ...approved,
      rows: [
        {
          ...approved.rows[0],
          issuer: "https://other.example.test/api/auth",
        },
      ],
    };
    expect(() =>
      validateReviewedManifest(
        wrongIssuerCore,
        approved.mappingDigest,
        approved.issuer,
      ),
    ).toThrow("invalid_reviewed_mapping_row");
  });

  it("refuses duplicate local IDs and provider subjects", () => {
    for (const duplicate of [
      { ...manifest().rows[0] },
      { ...manifest().rows[0], localUserId: "local-2" },
    ]) {
      const first = manifest();
      const core = { ...first, rows: [...first.rows, duplicate] };
      const candidate = { ...core, mappingDigest: sha256(core) };
      expect(() =>
        validateReviewedManifest(
          candidate,
          candidate.mappingDigest,
          candidate.issuer,
        ),
      ).toThrow("invalid_reviewed_mapping_row");
    }
  });
});
