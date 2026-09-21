#!/bin/sh
# Synthetic local proof only. Creates its own PostgreSQL container and databases,
# ignores DATABASE_URL, binds PostgreSQL only to loopback, and removes every
# container/file it creates. It must never receive or restore real user data.
set -eu

if [ "${AEGYO_SYNTHETIC_RESTORE_CONFIRM:-}" != "disposable-synthetic-backup-restore" ]; then
  echo "set AEGYO_SYNTHETIC_RESTORE_CONFIRM=disposable-synthetic-backup-restore" >&2
  exit 2
fi
if [ -n "${DATABASE_URL:-}" ] || [ -n "${AEGYO_MAPPING_DATABASE_URL:-}" ]; then
  echo "refusing inherited database connection variables" >&2
  exit 2
fi

container="aegyo-backup-restore-proof-$$"
proof_dir="$(pwd)/.proof/$container"
created=0
cleanup() {
  if [ "$created" -eq 1 ]; then docker stop "$container" >/dev/null 2>&1 || true; fi
  rm -rf "$proof_dir"
}
trap cleanup EXIT INT TERM
mkdir -p .proof
mkdir -m 700 "$proof_dir"

docker run --rm -d --name "$container" -p 127.0.0.1::5432 \
  -e POSTGRES_PASSWORD=proof -e POSTGRES_DB=aegyo_synthetic_source \
  postgres:18-alpine >/dev/null
created=1
attempt=0
until docker exec "$container" pg_isready -U postgres -d aegyo_synthetic_source >/dev/null 2>&1; do
  attempt=$((attempt + 1))
  if [ "$attempt" -ge 30 ]; then
    echo "disposable PostgreSQL did not become ready within 30 seconds" >&2
    exit 1
  fi
  sleep 1
done

docker exec -i "$container" psql -X -P pager=off -v ON_ERROR_STOP=1 \
  -U postgres -d aegyo_synthetic_source >/dev/null <<'SQL'
CREATE TABLE "User" (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, "displayName" TEXT,
  "avatarUrl" TEXT, bio TEXT, "passwordHash" TEXT NOT NULL,
  "emailVerified" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, role TEXT
);
CREATE TABLE "Session" (
  id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id),
  token TEXT NOT NULL UNIQUE, "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "PasswordReset" (
  id TEXT PRIMARY KEY, email TEXT NOT NULL, token TEXT NOT NULL UNIQUE,
  "expiresAt" TIMESTAMP(3) NOT NULL, used BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "Favorite" (id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id), "entityType" TEXT NOT NULL, "entityId" TEXT NOT NULL);
CREATE TABLE "Comment" (id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id), body TEXT NOT NULL);
CREATE TABLE "SuggestedEdit" (id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id), payload TEXT NOT NULL);
CREATE TABLE "PointEvent" (id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id), points INTEGER NOT NULL);
CREATE TABLE "PollVote" (id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id), choice TEXT NOT NULL);
CREATE TABLE "SlangVote" (id TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"(id), value INTEGER NOT NULL);
CREATE TABLE "Follow" (id TEXT PRIMARY KEY, "followerId" TEXT NOT NULL REFERENCES "User"(id), "targetSlug" TEXT NOT NULL);
CREATE TABLE "EventRegistration" (
  id TEXT PRIMARY KEY, "eventSlug" TEXT NOT NULL, name TEXT NOT NULL,
  email TEXT NOT NULL, "optIn" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE "CommunityAnnotation" (
  id TEXT PRIMARY KEY, "authorSlug" TEXT NOT NULL, "authorName" TEXT NOT NULL,
  "songTitle" TEXT NOT NULL, "songSlug" TEXT, "lineIndex" INTEGER,
  word TEXT NOT NULL, romanization TEXT NOT NULL, note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', "reviewedBy" TEXT,
  "reviewedAt" TIMESTAMP, "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "User" (id,email,"displayName","avatarUrl",bio,"passwordHash","emailVerified",role) VALUES
 ('synthetic-local-member','member@example.invalid','Synthetic Member','/member.png','member profile',repeat('a',64),true,'user'),
 ('synthetic-local-owner','owner@example.invalid','Synthetic Owner','/owner.png','owner profile',repeat('b',64),true,'admin');
INSERT INTO "Session" (id,"userId",token,"expiresAt") VALUES
 ('legacy-session-member','synthetic-local-member','legacy-token-member',CURRENT_TIMESTAMP + INTERVAL '1 day'),
 ('legacy-session-owner','synthetic-local-owner','legacy-token-owner',CURRENT_TIMESTAMP + INTERVAL '2 days');
INSERT INTO "PasswordReset" (id,email,token,"expiresAt",used) VALUES
 ('legacy-reset','member@example.invalid','legacy-reset-token',CURRENT_TIMESTAMP + INTERVAL '1 hour',false);
INSERT INTO "Favorite" VALUES ('synthetic-favorite','synthetic-local-owner','artist','synthetic-artist');
INSERT INTO "Comment" VALUES ('synthetic-comment','synthetic-local-owner','preserve comment');
INSERT INTO "SuggestedEdit" VALUES ('synthetic-edit','synthetic-local-owner','preserve edit');
INSERT INTO "PointEvent" VALUES ('synthetic-points','synthetic-local-owner',17);
INSERT INTO "PollVote" VALUES ('synthetic-poll-vote','synthetic-local-owner','yes');
INSERT INTO "SlangVote" VALUES ('synthetic-slang-vote','synthetic-local-owner',1);
INSERT INTO "Follow" VALUES ('synthetic-follow','synthetic-local-owner','synthetic-target');
INSERT INTO "EventRegistration" (id,"eventSlug",name,email,"optIn")
VALUES ('synthetic-event-registration','synthetic-event','Synthetic Attendee','attendee@example.invalid',true);
INSERT INTO "CommunityAnnotation" (id,"authorSlug","authorName","songTitle","songSlug","lineIndex",word,romanization,note,status,"reviewedBy","reviewedAt")
VALUES ('u-synthetic-annotation','synthetic-owner','Synthetic Owner','Synthetic Song','synthetic-song',3,'proof','peulipeu','preserve annotation','approved','Synthetic Moderator',CURRENT_TIMESTAMP);
SQL

entire_row_snapshot() {
  database=$1
  output=$2
  docker exec -i "$container" psql -X -P pager=off -At -v ON_ERROR_STOP=1 \
    -U postgres -d "$database" <<'SQL' >"$output"
SELECT jsonb_build_object(
  'User', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM (SELECT id,email,"displayName","avatarUrl",bio,"passwordHash","emailVerified","createdAt",role FROM "User") r),
  'Session', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM (SELECT id,"userId",token,"expiresAt","createdAt" FROM "Session") r),
  'PasswordReset', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM (SELECT id,email,token,"expiresAt",used,"createdAt" FROM "PasswordReset") r),
  'Favorite', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM (SELECT id,"userId","entityType","entityId" FROM "Favorite") r),
  'Comment', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM (SELECT id,"userId",body FROM "Comment") r),
  'SuggestedEdit', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM (SELECT id,"userId",payload FROM "SuggestedEdit") r),
  'PointEvent', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM (SELECT id,"userId",points FROM "PointEvent") r),
  'PollVote', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM (SELECT id,"userId",choice FROM "PollVote") r),
  'SlangVote', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM (SELECT id,"userId",value FROM "SlangVote") r),
  'Follow', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM (SELECT id,"followerId","targetSlug" FROM "Follow") r),
  'EventRegistration', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM (SELECT id,"eventSlug",name,email,"optIn","createdAt" FROM "EventRegistration") r),
  'CommunityAnnotation', (SELECT jsonb_agg(to_jsonb(r) ORDER BY r.id) FROM (SELECT id,"authorSlug","authorName","songTitle","songSlug","lineIndex",word,romanization,note,status,"reviewedBy","reviewedAt","createdAt" FROM "CommunityAnnotation") r)
);
SQL
  chmod 600 "$output"
}

entire_row_snapshot aegyo_synthetic_source "$proof_dir/rows-before-backup.json"

# The backup never leaves the disposable container and contains synthetic rows only.
docker exec "$container" pg_dump -U postgres -d aegyo_synthetic_source \
  --format=custom --file=/tmp/aegyo-synthetic.dump
docker exec "$container" pg_restore --list /tmp/aegyo-synthetic.dump >/dev/null
docker exec "$container" createdb -U postgres aegyo_synthetic_restored
docker exec "$container" pg_restore -U postgres -d aegyo_synthetic_restored \
  --exit-on-error /tmp/aegyo-synthetic.dump

snapshot() {
  database=$1
  output=$2
  docker exec -i "$container" psql -X -P pager=off -At -v ON_ERROR_STOP=1 \
    -U postgres -d "$database" <<'SQL' >"$output"
SELECT jsonb_build_object(
  'version', 1,
  'users', jsonb_agg(jsonb_build_object(
    'id', u.id,
    'role', u.role,
    'linkedRecords', jsonb_build_object(
      'Favorite', COALESCE((SELECT jsonb_agg(id ORDER BY id) FROM "Favorite" WHERE "userId"=u.id), '[]'::jsonb),
      'Comment', COALESCE((SELECT jsonb_agg(id ORDER BY id) FROM "Comment" WHERE "userId"=u.id), '[]'::jsonb),
      'SuggestedEdit', COALESCE((SELECT jsonb_agg(id ORDER BY id) FROM "SuggestedEdit" WHERE "userId"=u.id), '[]'::jsonb),
      'PointEvent', COALESCE((SELECT jsonb_agg(id ORDER BY id) FROM "PointEvent" WHERE "userId"=u.id), '[]'::jsonb),
      'PollVote', COALESCE((SELECT jsonb_agg(id ORDER BY id) FROM "PollVote" WHERE "userId"=u.id), '[]'::jsonb),
      'SlangVote', COALESCE((SELECT jsonb_agg(id ORDER BY id) FROM "SlangVote" WHERE "userId"=u.id), '[]'::jsonb),
      'Follow', COALESCE((SELECT jsonb_agg(id ORDER BY id) FROM "Follow" WHERE "followerId"=u.id), '[]'::jsonb)
    )
  ) ORDER BY u.id)
) FROM "User" u;
SQL
  chmod 600 "$output"
}

snapshot aegyo_synthetic_source "$proof_dir/local-source.json"
snapshot aegyo_synthetic_restored "$proof_dir/local-before.json"
cmp "$proof_dir/local-source.json" "$proof_dir/local-before.json"

cat >"$proof_dir/accounts.json" <<'JSON'
{"version":1,"issuer":"https://accounts.example.test/api/auth","subjects":["opaque-subject-member","opaque-subject-owner"]}
JSON
cat >"$proof_dir/mapping.json" <<'JSON'
{"version":1,"pairs":[{"localUserId":"synthetic-local-member","subject":"opaque-subject-member"},{"localUserId":"synthetic-local-owner","subject":"opaque-subject-owner"}]}
JSON
chmod 600 "$proof_dir/accounts.json" "$proof_dir/mapping.json"

node scripts/shared-auth/reconcile.mjs \
  "$proof_dir/local-before.json" "$proof_dir/accounts.json" \
  "$proof_dir/mapping.json" "$proof_dir/local-before.json" \
  "$proof_dir/reviewed-manifest.json" >/dev/null
digest=$(node -e 'const m=require(process.argv[1]); process.stdout.write(m.mappingDigest)' "$proof_dir/reviewed-manifest.json")

docker exec -i "$container" psql -X -P pager=off -v ON_ERROR_STOP=1 \
  -U postgres -d aegyo_synthetic_restored \
  < prisma/migrations/20260911200000_add_shared_auth/migration.sql >/dev/null
port=$(docker port "$container" 5432/tcp | sed -n 's/.*://p' | head -1)
test -n "$port"
mapping_cli() {
  command=$1
  confirmation=${2:-status-does-not-use-confirmation}
  env -u DATABASE_URL \
    AEGYO_MAPPING_DATABASE_URL="postgresql://postgres:proof@127.0.0.1:$port/aegyo_synthetic_restored" \
    AEGYO_MAPPING_DATABASE_NAME=aegyo_synthetic_restored \
    AEGYO_AUTH_BASE_URL=https://accounts.example.test \
    AEGYO_MAPPING_MANIFEST="$proof_dir/reviewed-manifest.json" \
    AEGYO_MAPPING_APPROVED_DIGEST="$digest" \
    AEGYO_SHARED_AUTH_ENABLED=true \
    AEGYO_AUTH_CUTOVER_FREEZE=true \
    AEGYO_MAPPING_CONFIRM="$confirmation" \
    node scripts/shared-auth/install-mappings.mjs "$command"
}
mapping_cli apply install-reviewed-mappings-without-latch >/dev/null
mapping_cli status >/dev/null
mapping_cli activate activate-reviewed-shared-auth-cutover >/dev/null
status=$(mapping_cli status)
case "$status" in *'"active":true'*) ;; *) echo "mapping status is not active" >&2; exit 1;; esac

entire_row_snapshot aegyo_synthetic_restored "$proof_dir/rows-after-activation.json"
cmp "$proof_dir/rows-before-backup.json" "$proof_dir/rows-after-activation.json"
snapshot aegyo_synthetic_restored "$proof_dir/local-after.json"
node scripts/shared-auth/reconcile.mjs \
  "$proof_dir/local-before.json" "$proof_dir/accounts.json" \
  "$proof_dir/mapping.json" "$proof_dir/local-after.json" \
  "$proof_dir/post-activation-manifest.json" >/dev/null
after_digest=$(node -e 'const m=require(process.argv[1]); process.stdout.write(m.mappingDigest)' "$proof_dir/post-activation-manifest.json")
test "$after_digest" = "$digest"

preserved=$(docker exec "$container" psql -X -P pager=off -At -U postgres \
  -d aegyo_synthetic_restored -c "SELECT
  (SELECT count(*) FROM \"User\" WHERE
    (id='synthetic-local-member' AND email='member@example.invalid' AND \"displayName\"='Synthetic Member' AND \"avatarUrl\"='/member.png' AND bio='member profile' AND \"passwordHash\"=repeat('a',64) AND \"emailVerified\" AND role='user') OR
    (id='synthetic-local-owner' AND email='owner@example.invalid' AND \"displayName\"='Synthetic Owner' AND \"avatarUrl\"='/owner.png' AND bio='owner profile' AND \"passwordHash\"=repeat('b',64) AND \"emailVerified\" AND role='admin')),
  (SELECT count(*) FROM \"Session\" WHERE
    ((id='legacy-session-member' AND token='legacy-token-member') OR (id='legacy-session-owner' AND token='legacy-token-owner'))
    AND \"providerSessionId\" IS NULL AND \"authenticatedAt\" IS NULL AND \"providerCheckedAt\" IS NULL AND \"securityVersion\" IS NULL AND \"passwordResetAt\" IS NULL),
  (SELECT count(*) FROM \"PasswordReset\" WHERE id='legacy-reset' AND token='legacy-reset-token' AND NOT used),
  (SELECT count(*) FROM \"Favorite\"), (SELECT count(*) FROM \"Comment\"),
  (SELECT count(*) FROM \"SuggestedEdit\"), (SELECT count(*) FROM \"PointEvent\"),
  (SELECT count(*) FROM \"PollVote\"), (SELECT count(*) FROM \"SlangVote\"),
  (SELECT count(*) FROM \"Follow\"),
  (SELECT count(*) FROM \"EventRegistration\"),
  (SELECT count(*) FROM \"CommunityAnnotation\"),
  (SELECT count(*) FROM \"SharedAuthIdentity\" WHERE issuer='https://accounts.example.test/api/auth'),
  (SELECT count(*) FROM \"AuthCutoverLatch\" WHERE \"mappingDigest\"='$digest');")
if [ "$preserved" != "2|2|1|1|1|1|1|1|1|1|1|1|2|1" ]; then
  echo "backup/restore preservation failed: $preserved" >&2
  exit 1
fi

# A separately restored database starts with one conflicting exact-user mapping.
# The real apply command must refuse it and leave both mapping and latch counts unchanged.
docker exec "$container" createdb -U postgres aegyo_synthetic_conflict
docker exec "$container" pg_restore -U postgres -d aegyo_synthetic_conflict \
  --exit-on-error /tmp/aegyo-synthetic.dump
docker exec -i "$container" psql -X -P pager=off -v ON_ERROR_STOP=1 \
  -U postgres -d aegyo_synthetic_conflict \
  < prisma/migrations/20260911200000_add_shared_auth/migration.sql >/dev/null
docker exec "$container" psql -X -P pager=off -v ON_ERROR_STOP=1 -U postgres \
  -d aegyo_synthetic_conflict -c "INSERT INTO \"SharedAuthIdentity\" (id,\"userId\",issuer,subject,\"updatedAt\") VALUES ('conflict','synthetic-local-owner','https://accounts.example.test/api/auth','wrong-subject',CURRENT_TIMESTAMP)" >/dev/null
if env -u DATABASE_URL \
  AEGYO_MAPPING_DATABASE_URL="postgresql://postgres:proof@127.0.0.1:$port/aegyo_synthetic_conflict" \
  AEGYO_MAPPING_DATABASE_NAME=aegyo_synthetic_conflict \
  AEGYO_AUTH_BASE_URL=https://accounts.example.test \
  AEGYO_MAPPING_MANIFEST="$proof_dir/reviewed-manifest.json" \
  AEGYO_MAPPING_APPROVED_DIGEST="$digest" \
  AEGYO_MAPPING_CONFIRM=install-reviewed-mappings-without-latch \
  node scripts/shared-auth/install-mappings.mjs apply >/dev/null 2>&1; then
  echo "conflicting mapping unexpectedly succeeded" >&2
  exit 1
fi
conflict_state=$(docker exec "$container" psql -X -P pager=off -At -U postgres \
  -d aegyo_synthetic_conflict -c 'SELECT (SELECT count(*) FROM "SharedAuthIdentity"),(SELECT count(*) FROM "AuthCutoverLatch");')
test "$conflict_state" = "1|0"

echo "PASS synthetic pg_dump/restore, preservation, mapping install, activation, reconciliation, and transactional conflict refusal"
