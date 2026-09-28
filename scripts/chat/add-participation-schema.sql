\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(hashtext('aegyo-chat-participation-v1'));
DO $$ BEGIN
  IF to_regclass('public."User"') IS NULL OR to_regclass('public."ChatMessage"') IS NULL THEN
    RAISE EXCEPTION 'chat base schema missing';
  END IF;
  IF to_regclass('public."ChatParticipation"') IS NOT NULL THEN
    RAISE EXCEPTION 'ChatParticipation already exists';
  END IF;
END $$;
CREATE TABLE "ChatParticipation" (
  "userId" TEXT NOT NULL,
  "rulesVersion" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "age16ConfirmedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatParticipation_pkey" PRIMARY KEY ("userId")
);
ALTER TABLE "ChatParticipation" ADD CONSTRAINT "ChatParticipation_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;
