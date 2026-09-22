#!/bin/sh
# Disposable local proof only. This script ignores any existing DATABASE_URL,
# creates its own PostgreSQL 18 container, and binds its random port to loopback.
set -eu

container="aegyo-provisioning-proof-$$"
created=0
cleanup() {
  if [ "$created" -eq 1 ]; then
    docker stop "$container" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

docker run --rm -d --name "$container" -p 127.0.0.1::5432 \
  -e POSTGRES_PASSWORD=proof -e POSTGRES_DB=proof postgres:18-alpine >/dev/null
created=1

attempt=0
until docker exec "$container" pg_isready -U postgres -d proof >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "disposable PostgreSQL did not become ready within 30 seconds" >&2
    exit 1
  fi
  sleep 1
done

docker exec -i "$container" psql -X -P pager=off -v ON_ERROR_STOP=1 -U postgres -d proof >/dev/null <<'SQL'
CREATE TABLE "User" (
  "id" TEXT PRIMARY KEY,
  "email" TEXT NOT NULL UNIQUE,
  "displayName" TEXT,
  "avatarUrl" TEXT,
  "bio" TEXT,
  "passwordHash" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "role" TEXT NOT NULL DEFAULT 'user'
);
CREATE TABLE "Session" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "token" TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Favorite" (
  "id" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id"),
  "entityType" TEXT NOT NULL,
  "entityId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE ("userId", "entityType", "entityId")
);
SQL

docker exec -i "$container" psql -X -P pager=off -v ON_ERROR_STOP=1 -U postgres -d proof \
  < prisma/migrations/20260911200000_add_shared_auth/migration.sql >/dev/null

port=$(docker port "$container" 5432/tcp | sed -n 's/.*://p' | head -1)
if [ -z "$port" ]; then
  echo "could not determine disposable PostgreSQL port" >&2
  exit 1
fi

DATABASE_URL="postgresql://postgres:proof@127.0.0.1:$port/proof" \
  AEGYO_PROVISIONING_POSTGRES_PROOF=1 \
  npx vitest run tests/shared-auth-provisioning-postgres.test.ts

docker exec "$container" createdb -U postgres aegyo_synthetic_staging
AEGYO_STAGING_CONFIRM=initialize-empty-synthetic-staging-database \
  AEGYO_STAGING_DATABASE_URL="postgresql://postgres:proof@127.0.0.1:$port/aegyo_synthetic_staging" \
AEGYO_STAGING_DATABASE_NAME=aegyo_synthetic_staging \
AEGYO_AUTH_BASE_URL=https://accounts-staging.example.test \
  AEGYO_SHARED_AUTH_ENABLED=true \
  AEGYO_AUTH_CUTOVER_FREEZE=true \
  AEGYO_STAGING_FIXTURE=staging/fixtures.example.json \
  node scripts/staging/initialize-synthetic.mjs >/dev/null
if AEGYO_STAGING_CONFIRM=initialize-empty-synthetic-staging-database \
  AEGYO_STAGING_DATABASE_URL="postgresql://postgres:proof@127.0.0.1:$port/aegyo_synthetic_staging" \
  AEGYO_STAGING_DATABASE_NAME=aegyo_synthetic_staging \
  AEGYO_AUTH_BASE_URL=https://accounts-staging.example.test \
  AEGYO_SHARED_AUTH_ENABLED=true \
  AEGYO_AUTH_CUTOVER_FREEZE=true \
  AEGYO_STAGING_FIXTURE=staging/fixtures.example.json \
  node scripts/staging/initialize-synthetic.mjs >/dev/null 2>&1; then
  echo "synthetic staging initializer unexpectedly accepted a non-empty database" >&2
  exit 1
fi

initialized=$(docker exec "$container" psql -X -P pager=off -At -U postgres -d aegyo_synthetic_staging -c \
  "SELECT
    (SELECT count(*) FROM \"User\" WHERE id='staging-existing-local-user' AND role='moderator'),
    (SELECT count(*) FROM \"SharedAuthIdentity\" WHERE subject='8bd36a4e-8a7b-4d61-b28c-22e285f8730f'),
    (SELECT count(*) FROM \"SharedAuthIdentity\" WHERE subject='5b3d3e59-fe9c-487a-ac44-eedb0b2c3743'),
    (SELECT count(*) FROM \"AuthCutoverLatch\");")
if [ "$initialized" != "1|1|0|1" ]; then
  echo "synthetic staging initialization failed: $initialized" >&2
  exit 1
fi
