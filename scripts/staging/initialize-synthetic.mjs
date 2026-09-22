#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";
import { sha256 } from "../shared-auth/reconciliation-lib.mjs";
import {
  activateMappings,
  applyMappings,
  exactIssuer,
} from "../shared-auth/mapping-installer-lib.mjs";

const EXTERNAL_PASSWORD_SENTINEL = "!shared-auth-only!";

const fail = (code) => {
  throw new Error(code);
};
const required = (name) => process.env[name] || fail(`missing_${name}`);
function fixture(input) {
  if (
    input?.version !== 1 ||
    typeof input.issuer !== "string" ||
    !input.issuer.endsWith("/api/auth") ||
    !input.existing ||
    !input.new ||
    ![input.existing.localUserId, input.existing.subject, input.existing.email, input.existing.displayName, input.existing.role, input.new.subject, input.new.email].every(
      (item) => typeof item === "string" && item.length > 0 && item.length <= 500,
    ) ||
    input.existing.subject === input.new.subject ||
    input.existing.email.trim().toLowerCase() === input.new.email.trim().toLowerCase()
  )
    fail("invalid_synthetic_fixture");
  return input;
}

let prisma;
try {
  if (process.env.DATABASE_URL) fail("ordinary_DATABASE_URL_forbidden");
  if (
    required("AEGYO_STAGING_CONFIRM") !==
    "initialize-empty-synthetic-staging-database"
  )
    fail("staging_confirmation_missing");
  const url = new URL(required("AEGYO_STAGING_DATABASE_URL"));
  const databaseName = required("AEGYO_STAGING_DATABASE_NAME");
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !["127.0.0.1", "localhost", "::1"].includes(url.hostname) ||
    decodeURIComponent(url.pathname.slice(1)) !== databaseName ||
    !/staging/i.test(databaseName)
  )
    fail("local_staging_database_binding_invalid");
  const input = fixture(
    JSON.parse(await readFile(required("AEGYO_STAGING_FIXTURE"), "utf8")),
  );
  const expectedIssuer = exactIssuer(required("AEGYO_AUTH_BASE_URL"));
  if (input.issuer !== expectedIssuer) fail("synthetic_fixture_issuer_mismatch");

  prisma = new PrismaClient({
    datasources: { db: { url: url.toString() } },
  });
  const binding = await prisma.$queryRaw`
    SELECT current_database() AS name,
      (SELECT count(*)::int FROM pg_catalog.pg_tables WHERE schemaname='public') AS tables
  `;
  if (binding[0]?.name !== databaseName || binding[0]?.tables !== 0)
    fail("staging_database_not_empty");
  await prisma.$disconnect();
  prisma = undefined;

  const pushed = spawnSync(
    "./node_modules/.bin/prisma",
    ["db", "push", "--skip-generate"],
    {
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: url.toString() },
    },
  );
  if (pushed.status !== 0) fail("synthetic_schema_push_failed");
  prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } });
  await prisma.$executeRawUnsafe('ALTER TABLE "User" ADD COLUMN "role" TEXT');
  await prisma.$executeRawUnsafe(`ALTER TABLE "AuthCutoverLatch"
    ADD CONSTRAINT "AuthCutoverLatch_fixed_id" CHECK ("id" = 'accounts-shared-auth-v1'),
    ADD CONSTRAINT "AuthCutoverLatch_mapping_digest" CHECK ("mappingDigest" ~ '^[0-9a-f]{64}$')`);
  await prisma.$executeRawUnsafe(`CREATE FUNCTION "reject_auth_cutover_latch_mutation"()
    RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN RAISE EXCEPTION 'AuthCutoverLatch is monotonic and cannot be changed'; END; $$`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER "AuthCutoverLatch_reject_update_delete"
    BEFORE UPDATE OR DELETE ON "AuthCutoverLatch"
    FOR EACH ROW EXECUTE FUNCTION "reject_auth_cutover_latch_mutation"()`);
  await prisma.$executeRawUnsafe(`CREATE TRIGGER "AuthCutoverLatch_reject_truncate"
    BEFORE TRUNCATE ON "AuthCutoverLatch"
    FOR EACH STATEMENT EXECUTE FUNCTION "reject_auth_cutover_latch_mutation"()`);
  await prisma.user.create({
    data: {
      id: input.existing.localUserId,
      email: input.existing.email.trim().toLowerCase(),
      displayName: input.existing.displayName,
      passwordHash: EXTERNAL_PASSWORD_SENTINEL,
      emailVerified: true,
    },
  });
  await prisma.$executeRaw`UPDATE "User" SET role=${input.existing.role} WHERE id=${input.existing.localUserId}`;
  const rows = [
    {
      localUserId: input.existing.localUserId,
      issuer: input.issuer,
      subject: input.existing.subject,
      role: input.existing.role,
      linkedRecordsDigest: sha256({}),
    },
  ];
  const core = {
    version: 1,
    issuer: input.issuer,
    localSnapshotDigest: sha256({
      users: [{ id: input.existing.localUserId, role: input.existing.role }],
    }),
    accountsSubjectsDigest: sha256([input.existing.subject]),
    rows,
  };
  const manifest = { ...core, mappingDigest: sha256(core) };
  await applyMappings(prisma, manifest);
  await activateMappings(prisma, manifest, process.env);
  console.info(
    JSON.stringify({
      existingLocalUserId: input.existing.localUserId,
      existingSubject: input.existing.subject,
      newSubject: input.new.subject,
      newLocalUserExpected: false,
      mappingDigest: manifest.mappingDigest,
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : "synthetic_staging_init_failed");
  process.exitCode = 1;
} finally {
  await prisma?.$disconnect();
}
