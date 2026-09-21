import { randomUUID } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "../lib/prisma";
import { sha256 } from "../scripts/shared-auth/reconciliation-lib.mjs";
import {
  activateMappings,
  applyMappings,
  inspectMappings,
  validateReviewedManifest,
} from "../scripts/shared-auth/mapping-installer-lib.mjs";
import {
  createSharedSession,
  EXTERNAL_PASSWORD_SENTINEL,
} from "../lib/shared-auth/session";

const enabled = process.env.AEGYO_PROVISIONING_POSTGRES_PROOF === "1";
const issuer = "https://accounts.example.test/api/auth";
const safeActivationEnvironment = {
  AEGYO_SHARED_AUTH_ENABLED: "true",
  AEGYO_AUTH_CUTOVER_FREEZE: "true",
};
const resetState = {
  version: 1 as const,
  kind: "database" as const,
  lastPasswordReset: null,
};
function input(subject: string, email: string) {
  return {
    issuer,
    subject,
    email,
    emailVerified: true,
    name: "Synthetic member",
    picture: null,
    providerSessionId: `sid-${randomUUID()}`,
    authenticatedAtMs: Date.now(),
    securityVersion: 1,
    resetState,
  };
}

describe.runIf(enabled)("shared provisioning on disposable PostgreSQL", () => {
  afterAll(async () => prisma.$disconnect());

  it("creates one user and identity but two valid sessions for simultaneous callbacks", async () => {
    const subject = `same-${randomUUID()}`;
    const email = `same-${randomUUID()}@example.invalid`;
    const sessions = await Promise.all([
      createSharedSession(input(subject, email)),
      createSharedSession(input(subject, email.toUpperCase())),
    ]);
    const identity = await prisma.sharedAuthIdentity.findUniqueOrThrow({
      where: { issuer_subject: { issuer, subject } },
      include: { user: true },
    });
    expect(identity.user.passwordHash).toBe(EXTERNAL_PASSWORD_SENTINEL);
    expect(
      await prisma.user.count({ where: { email: email.toLowerCase() } }),
    ).toBe(1);
    expect(
      await prisma.session.count({
        where: {
          userId: identity.userId,
          token: { in: sessions.map(({ token }) => token) },
          providerSessionId: { not: null },
        },
      }),
    ).toBe(2);
  });

  it("allows one winner for different subjects sharing a normalized email", async () => {
    const email = `contested-${randomUUID()}@example.invalid`;
    const results = await Promise.allSettled([
      createSharedSession(input(`first-${randomUUID()}`, email)),
      createSharedSession(input(`second-${randomUUID()}`, email.toUpperCase())),
    ]);
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
      1,
    );
    expect(results.filter((result) => result.status === "rejected")).toHaveLength(
      1,
    );
    expect(
      await prisma.user.count({ where: { email: email.toLowerCase() } }),
    ).toBe(1);
    const user = await prisma.user.findUniqueOrThrow({
      where: { email: email.toLowerCase() },
      include: { sharedIdentity: true },
    });
    expect(user.sharedIdentity).not.toBeNull();
  });

  it("leaves a mixed-case legacy email and its lack of mapping unchanged", async () => {
    const id = `legacy-${randomUUID()}`;
    const canonicalEmail = `Legacy-${randomUUID()}@Example.Invalid`;
    const email = `  ${canonicalEmail}  `;
    await prisma.$executeRaw`
      INSERT INTO "User" ("id", "email", "passwordHash", "role")
      VALUES (${id}, ${email}, ${"a".repeat(64)}, 'moderator')
    `;
    await prisma.$executeRaw`
      INSERT INTO "Favorite" ("id", "userId", "entityType", "entityId")
      VALUES (${`favorite-${id}`}, ${id}, 'artist', 'artist-1')
    `;
    await expect(
      createSharedSession(
        input(`legacy-sub-${randomUUID()}`, canonicalEmail.toLowerCase()),
      ),
    ).rejects.toThrow("local_email_collision");
    const rows = await prisma.$queryRaw<
      Array<{ email: string; passwordHash: string; role: string }>
    >`SELECT "email", "passwordHash", "role" FROM "User" WHERE "id" = ${id}`;
    expect(rows).toEqual([
      { email, passwordHash: "a".repeat(64), role: "moderator" },
    ]);
    expect(
      await prisma.sharedAuthIdentity.count({ where: { userId: id } }),
    ).toBe(0);
  });

  it("installs only complete reviewed mappings, then activates the exact digest separately", async () => {
    const beforeUsers = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "User" ORDER BY id
    `;
    const beforeSessions = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "Session" ORDER BY id
    `;
    const beforeFavorites = await prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT * FROM "Favorite" ORDER BY id
    `;
    const users = await prisma.$queryRaw<Array<{ id: string; role: string | null }>>`
      SELECT id, role FROM "User" ORDER BY id
    `;
    const current = await prisma.sharedAuthIdentity.findMany({
      select: { userId: true, issuer: true, subject: true },
    });
    const byUser = new Map(current.map((row) => [row.userId, row]));
    const rows = users.map((user) => ({
      localUserId: user.id,
      issuer,
      subject: byUser.get(user.id)?.subject ?? `imported-${randomUUID()}`,
      role: user.role,
      linkedRecordsDigest: sha256({ synthetic: user.id }),
    }));
    const core = {
      version: 1,
      issuer,
      localSnapshotDigest: sha256({ users: users.map(({ id, role }) => ({ id, role })) }),
      accountsSubjectsDigest: sha256(rows.map((row) => row.subject).sort()),
      rows,
    };
    const manifest = { ...core, mappingDigest: sha256(core) };
    expect(
      validateReviewedManifest(manifest, manifest.mappingDigest, issuer),
    ).toBe(manifest);

    const partialCore = { ...core, rows: rows.slice(1) };
    await expect(
      applyMappings(prisma, {
        ...partialCore,
        mappingDigest: sha256(partialCore),
      }),
    ).rejects.toThrow("partial_user_population");

    await expect(applyMappings(prisma, manifest)).resolves.toMatchObject({
      count: users.length,
    });
    await expect(applyMappings(prisma, manifest)).resolves.toMatchObject({
      count: users.length,
    });
    const remappedRows = rows.map((row, index) =>
      index === 0 ? { ...row, subject: `remap-${randomUUID()}` } : row,
    );
    const remappedCore = { ...core, rows: remappedRows };
    await expect(
      applyMappings(prisma, {
        ...remappedCore,
        mappingDigest: sha256(remappedCore),
      }),
    ).rejects.toThrow("existing_mapping_conflict");

    await expect(
      activateMappings(prisma, manifest, safeActivationEnvironment),
    ).resolves.toEqual({
      alreadyActive: false,
      mappingDigest: manifest.mappingDigest,
    });
    await expect(
      activateMappings(prisma, manifest, safeActivationEnvironment),
    ).resolves.toEqual({
      alreadyActive: true,
      mappingDigest: manifest.mappingDigest,
    });
    await expect(inspectMappings(prisma, manifest)).resolves.toMatchObject({
      active: true,
      count: users.length,
    });
    const alternateCore = {
      ...core,
      accountsSubjectsDigest: "f".repeat(64),
    };
    await expect(
      activateMappings(
        prisma,
        {
          ...alternateCore,
          mappingDigest: sha256(alternateCore),
        },
        safeActivationEnvironment,
      ),
    ).rejects.toThrow("latch_digest_mismatch");

    expect(await prisma.$queryRaw`SELECT * FROM "User" ORDER BY id`).toEqual(
      beforeUsers,
    );
    expect(
      await prisma.$queryRaw`SELECT * FROM "Session" ORDER BY id`,
    ).toEqual(beforeSessions);
    expect(
      await prisma.$queryRaw`SELECT * FROM "Favorite" ORDER BY id`,
    ).toEqual(beforeFavorites);
    expect(
      await prisma.sharedAuthIdentity.count({ where: { issuer } }),
    ).toBe(users.length);

    const proofDirectory = `.proof/mapping-${randomUUID()}`;
    const manifestPath = `${proofDirectory}/manifest.json`;
    await mkdir(proofDirectory, { recursive: true, mode: 0o700 });
    await writeFile(manifestPath, `${JSON.stringify(manifest)}\n`, {
      mode: 0o600,
    });
    try {
      const run = (command: string, confirmation?: string) => {
        const environment = { ...process.env };
        delete environment.DATABASE_URL;
        return spawnSync(
          process.execPath,
          ["scripts/shared-auth/install-mappings.mjs", command],
          {
            cwd: process.cwd(),
            encoding: "utf8",
            timeout: 15_000,
            env: {
              ...environment,
              AEGYO_MAPPING_DATABASE_URL: process.env.DATABASE_URL,
              AEGYO_MAPPING_DATABASE_NAME: "proof",
              AEGYO_AUTH_BASE_URL: "https://accounts.example.test",
              AEGYO_MAPPING_MANIFEST: manifestPath,
              AEGYO_MAPPING_APPROVED_DIGEST: manifest.mappingDigest,
              AEGYO_SHARED_AUTH_ENABLED: "true",
              AEGYO_AUTH_CUTOVER_FREEZE: "true",
              ...(confirmation ? { AEGYO_MAPPING_CONFIRM: confirmation } : {}),
            },
          },
        );
      };
      const status = run("status");
      expect(status.status, status.stderr).toBe(0);
      expect(JSON.parse(status.stdout)).toMatchObject({
        active: true,
        count: users.length,
        mappingDigest: manifest.mappingDigest,
      });
      const retry = run(
        "apply",
        "install-reviewed-mappings-without-latch",
      );
      expect(retry.status, retry.stderr).toBe(0);
      const activationRetry = run(
        "activate",
        "activate-reviewed-shared-auth-cutover",
      );
      expect(activationRetry.status, activationRetry.stderr).toBe(0);
      expect(JSON.parse(activationRetry.stdout)).toMatchObject({
        alreadyActive: true,
      });

      const removed = rows[0];
      await prisma.sharedAuthIdentity.delete({
        where: {
          issuer_subject: { issuer: removed.issuer, subject: removed.subject },
        },
      });
      await expect(applyMappings(prisma, manifest)).rejects.toThrow(
        "mapping_coverage_incomplete",
      );
      expect(
        await prisma.sharedAuthIdentity.findUnique({
          where: {
            issuer_subject: {
              issuer: removed.issuer,
              subject: removed.subject,
            },
          },
        }),
      ).toBeNull();
    } finally {
      await rm(proofDirectory, { recursive: true, force: true });
    }
  });
});
