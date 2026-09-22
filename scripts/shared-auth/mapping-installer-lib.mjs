import { canonicalJson, sha256 } from "./reconciliation-lib.mjs";

export class MappingRefusal extends Error {}
const refuse = (code) => {
  throw new MappingRefusal(code);
};
const hex64 = /^[0-9a-f]{64}$/;
const value = (input, limit = 500) =>
  typeof input === "string" &&
  input.length > 0 &&
  input.length <= limit &&
  !/[\u0000-\u001f]/u.test(input);

export function requireSafeActivationEnvironment(environment) {
  if (environment?.AEGYO_SHARED_AUTH_ENABLED !== "true")
    refuse("shared_auth_flag_not_enabled");
  if (environment?.AEGYO_AUTH_CUTOVER_FREEZE !== "true")
    refuse("cutover_freeze_not_enabled");
}

export function exactIssuer(baseUrl) {
  let base;
  try {
    base = new URL(baseUrl);
  } catch {
    refuse("invalid_app_auth_base_url");
  }
  if (
    base.protocol !== "https:" ||
    base.pathname !== "/" ||
    base.search ||
    base.hash ||
    base.username ||
    base.password
  )
    refuse("invalid_app_auth_base_url");
  return `${base.origin}/api/auth`;
}

export function validateReviewedManifest(input, approvedDigest, issuer) {
  if (
    input?.version !== 1 ||
    input.issuer !== issuer ||
    !hex64.test(input.localSnapshotDigest ?? "") ||
    !hex64.test(input.accountsSubjectsDigest ?? "") ||
    !Array.isArray(input.rows) ||
    input.rows.length < 1 ||
    input.rows.length > 100000 ||
    !hex64.test(input.mappingDigest ?? "") ||
    input.mappingDigest !== approvedDigest
  )
    refuse("invalid_reviewed_manifest");
  const ids = new Set();
  const subjects = new Set();
  const rows = input.rows.map((row) => {
    if (
      !value(row?.localUserId, 200) ||
      row.issuer !== issuer ||
      !value(row.subject, 500) ||
      !(row.role === null || value(row.role, 200)) ||
      !hex64.test(row.linkedRecordsDigest ?? "") ||
      ids.has(row.localUserId) ||
      subjects.has(row.subject)
    )
      refuse("invalid_reviewed_mapping_row");
    ids.add(row.localUserId);
    subjects.add(row.subject);
    return { ...row };
  });
  if (canonicalJson(rows) !== canonicalJson([...rows].sort((a, b) => a.localUserId.localeCompare(b.localUserId))))
    refuse("manifest_rows_not_canonical");
  const { mappingDigest: _ignored, ...core } = input;
  if (sha256(core) !== input.mappingDigest) refuse("manifest_digest_mismatch");
  return input;
}

async function verifyPopulation(tx, manifest) {
  const users = await tx.$queryRaw`SELECT id, role FROM "User"`;
  if (users.length !== manifest.rows.length) refuse("partial_user_population");
  const rolesById = new Map(users.map((user) => [user.id, user.role]));
  for (const expected of manifest.rows) {
    if (
      !rolesById.has(expected.localUserId) ||
      rolesById.get(expected.localUserId) !== expected.role
    )
      refuse("user_id_or_role_changed");
  }
  return users;
}

async function verifyMappings(tx, manifest, allowMissing) {
  const identities = await tx.$queryRaw`
    SELECT "userId", issuer, subject FROM "SharedAuthIdentity" ORDER BY "userId"
  `;
  const expectedByUser = new Map(
    manifest.rows.map((row) => [row.localUserId, row]),
  );
  for (const identity of identities) {
    const expected = expectedByUser.get(identity.userId);
    if (
      !expected ||
      identity.issuer !== expected.issuer ||
      identity.subject !== expected.subject
    )
      refuse("existing_mapping_conflict");
  }
  if (!allowMissing && identities.length !== manifest.rows.length)
    refuse("mapping_coverage_incomplete");
  return identities;
}

export async function inspectMappings(prisma, manifest) {
  return prisma.$transaction(
    async (tx) => {
      await verifyPopulation(tx, manifest);
      await verifyMappings(tx, manifest, false);
      const latch = await tx.authCutoverLatch.findUnique({
        where: { id: "accounts-shared-auth-v1" },
        select: { mappingDigest: true },
      });
      if (latch && latch.mappingDigest !== manifest.mappingDigest)
        refuse("latch_digest_mismatch");
      return {
        count: manifest.rows.length,
        mappingDigest: manifest.mappingDigest,
        active: !!latch,
      };
    },
    { isolationLevel: "RepeatableRead" },
  );
}

export async function applyMappings(prisma, manifest) {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('aegyo-local-mapping-v1'))`;
    await tx.$executeRaw`LOCK TABLE "User", "SharedAuthIdentity" IN SHARE ROW EXCLUSIVE MODE`;
    await verifyPopulation(tx, manifest);
    const latch = await tx.authCutoverLatch.findUnique({
      where: { id: "accounts-shared-auth-v1" },
      select: { mappingDigest: true },
    });
    if (latch && latch.mappingDigest !== manifest.mappingDigest)
      refuse("latch_digest_mismatch");
    if (latch) {
      await verifyMappings(tx, manifest, false);
      return {
        count: manifest.rows.length,
        mappingDigest: manifest.mappingDigest,
      };
    }
    const existing = await verifyMappings(tx, manifest, true);
    const existingUsers = new Set(existing.map((row) => row.userId));
    for (const row of manifest.rows) {
      if (existingUsers.has(row.localUserId)) continue;
      await tx.sharedAuthIdentity.create({
        data: {
          userId: row.localUserId,
          issuer: row.issuer,
          subject: row.subject,
        },
      });
    }
    await verifyMappings(tx, manifest, false);
    return { count: manifest.rows.length, mappingDigest: manifest.mappingDigest };
  });
}

export async function activateMappings(prisma, manifest, environment) {
  requireSafeActivationEnvironment(environment);
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('aegyo-local-mapping-v1'))`;
    await tx.$executeRaw`LOCK TABLE "User", "SharedAuthIdentity", "AuthCutoverLatch" IN SHARE ROW EXCLUSIVE MODE`;
    await verifyPopulation(tx, manifest);
    await verifyMappings(tx, manifest, false);
    const existing = await tx.authCutoverLatch.findUnique({
      where: { id: "accounts-shared-auth-v1" },
      select: { mappingDigest: true },
    });
    if (existing) {
      if (existing.mappingDigest !== manifest.mappingDigest)
        refuse("latch_digest_mismatch");
      return { alreadyActive: true, mappingDigest: manifest.mappingDigest };
    }
    await tx.authCutoverLatch.create({
      data: {
        id: "accounts-shared-auth-v1",
        mappingDigest: manifest.mappingDigest,
      },
    });
    return { alreadyActive: false, mappingDigest: manifest.mappingDigest };
  });
}
