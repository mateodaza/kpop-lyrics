#!/usr/bin/env node
import { constants } from "node:fs";
import { open, realpath } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { PrismaClient } from "@prisma/client";
import {
  MappingRefusal,
  activateMappings,
  applyMappings,
  exactIssuer,
  inspectMappings,
  validateReviewedManifest,
} from "./mapping-installer-lib.mjs";

const fail = (code) => {
  throw new MappingRefusal(code);
};
const required = (name) => process.env[name] || fail(`missing_${name}`);
const proofRoot = resolve(process.cwd(), ".proof");
async function readPrivate(pathValue) {
  const path = resolve(pathValue);
  const parent = await realpath(dirname(path));
  const rel = relative(await realpath(proofRoot), parent);
  if (rel.startsWith("..") || rel.startsWith("/"))
    fail("manifest_outside_private_proof_directory");
  const file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.mode & 0o077 || stat.uid !== process.getuid() || stat.size > 16 * 1024 * 1024)
      fail("unsafe_manifest_file");
    return JSON.parse(await file.readFile("utf8"));
  } finally {
    await file.close();
  }
}

let prisma;
try {
  if (process.env.DATABASE_URL) fail("ordinary_DATABASE_URL_forbidden");
  const command = process.argv[2];
  if (!['apply', 'activate', 'status'].includes(command))
    fail("expected_apply_activate_or_status");
  const databaseUrl = required("AEGYO_MAPPING_DATABASE_URL");
  const expectedDatabase = required("AEGYO_MAPPING_DATABASE_NAME");
  const issuer = exactIssuer(required("AEGYO_AUTH_BASE_URL"));
  const manifest = validateReviewedManifest(
    await readPrivate(required("AEGYO_MAPPING_MANIFEST")),
    required("AEGYO_MAPPING_APPROVED_DIGEST"),
    issuer,
  );
  prisma = new PrismaClient({ datasources: { db: { url: databaseUrl } } });
  const databaseRows = await prisma.$queryRaw`SELECT current_database() AS name`;
  if (databaseRows[0]?.name !== expectedDatabase) fail("database_name_mismatch");
  let result;
  if (command === "apply") {
    if (required("AEGYO_MAPPING_CONFIRM") !== "install-reviewed-mappings-without-latch")
      fail("mapping_confirmation_missing");
    try {
      result = await applyMappings(prisma, manifest);
    } catch (error) {
      if (error instanceof MappingRefusal) throw error;
      fail("mapping_outcome_unknown_run_status");
    }
  } else if (command === "activate") {
    if (required("AEGYO_MAPPING_CONFIRM") !== "activate-reviewed-shared-auth-cutover")
      fail("activation_confirmation_missing");
    try {
      result = await activateMappings(prisma, manifest, process.env);
    } catch (error) {
      if (error instanceof MappingRefusal) throw error;
      fail("activation_outcome_unknown_run_status");
    }
  } else {
    result = await inspectMappings(prisma, manifest);
  }
  console.info(JSON.stringify(result));
} catch (error) {
  console.error(error instanceof MappingRefusal ? error.message : "mapping_operator_failed");
  process.exitCode = 1;
} finally {
  await prisma?.$disconnect();
}
