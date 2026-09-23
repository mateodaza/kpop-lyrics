\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '30s';
SELECT pg_advisory_xact_lock(hashtext('aegyo-chat-schema-v1'));
DO $$ BEGIN
  IF to_regclass('public."User"') IS NULL THEN RAISE EXCEPTION 'User table missing'; END IF;
  IF to_regclass('public."ChatMessage"') IS NOT NULL
     OR to_regclass('public."ChatReport"') IS NOT NULL
     OR to_regclass('public."ChatPostAttempt"') IS NOT NULL
     OR to_regclass('public."ChatMute"') IS NOT NULL
     OR to_regclass('public."ChatModerationEvent"') IS NOT NULL THEN
    RAISE EXCEPTION 'chat schema already exists or is partial';
  END IF;
END $$;
CREATE TABLE "ChatMessage" (
  "id" TEXT NOT NULL,
  "authorId" TEXT NOT NULL,
  "authorName" VARCHAR(32) NOT NULL,
  "body" VARCHAR(500) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'visible',
  "moderationNote" TEXT,
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatMessage_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ChatReport" (
  "id" TEXT NOT NULL,
  "messageId" TEXT NOT NULL,
  "reporterId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatReport_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ChatPostAttempt" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "bodyHash" TEXT NOT NULL,
  "outcome" TEXT NOT NULL DEFAULT 'pending',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatPostAttempt_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "ChatMute" (
  "userId" TEXT NOT NULL,
  "until" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ChatMute_pkey" PRIMARY KEY ("userId")
);
CREATE TABLE "ChatModerationEvent" (
  "id" TEXT NOT NULL,
  "messageId" TEXT,
  "userId" TEXT,
  "actorId" TEXT,
  "action" TEXT NOT NULL,
  "detail" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ChatModerationEvent_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "ChatMessage_status_createdAt_idx" ON "ChatMessage"("status", "createdAt");
CREATE INDEX "ChatMessage_authorId_createdAt_idx" ON "ChatMessage"("authorId", "createdAt");
CREATE UNIQUE INDEX "ChatReport_messageId_reporterId_key" ON "ChatReport"("messageId", "reporterId");
CREATE INDEX "ChatReport_createdAt_idx" ON "ChatReport"("createdAt");
CREATE INDEX "ChatPostAttempt_userId_createdAt_idx" ON "ChatPostAttempt"("userId", "createdAt");
CREATE INDEX "ChatPostAttempt_createdAt_idx" ON "ChatPostAttempt"("createdAt");
CREATE INDEX "ChatModerationEvent_messageId_createdAt_idx" ON "ChatModerationEvent"("messageId", "createdAt");
CREATE INDEX "ChatModerationEvent_userId_createdAt_idx" ON "ChatModerationEvent"("userId", "createdAt");
ALTER TABLE "ChatMessage" ADD CONSTRAINT "ChatMessage_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "ChatMessage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatReport" ADD CONSTRAINT "ChatReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatPostAttempt" ADD CONSTRAINT "ChatPostAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatMute" ADD CONSTRAINT "ChatMute_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
COMMIT;
