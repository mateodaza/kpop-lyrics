import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChatSession } from "@/lib/chat-auth";
import { canWriteChatInEnvironment, sameOrigin } from "@/lib/chat-policy";
import { readChatJson } from "@/lib/chat-request";
import { logChatFailure } from "@/lib/chat-logging";

const reasons = new Set(["abuse", "sexual", "spam", "personal_info", "other"]);

export async function POST(request: NextRequest) {
  if (process.env.AEGYO_CHAT_ENABLED !== "true") return NextResponse.json({ error: "Chat is not enabled." }, { status: 404 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getChatSession();
  if (!session) return NextResponse.json({ error: "Sign in with Aegyo Accounts to report a message." }, { status: 401 });
  if (!canWriteChatInEnvironment(session.user.email)) return NextResponse.json({ error: "Reporting is limited to preview testers." }, { status: 403 });
  const parsed = await readChatJson(request, 512);
  if (parsed.tooLarge) return NextResponse.json({ error: "Invalid report." }, { status: 413 });
  const input = parsed.value as { messageId?: unknown; reason?: unknown } | null;
  const messageId = typeof input?.messageId === "string" ? input.messageId : "";
  const reason = typeof input?.reason === "string" ? input.reason : "";
  if (!messageId || messageId.length > 40 || !reasons.has(reason)) return NextResponse.json({ error: "Choose a report reason." }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${messageId}))::text`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`chat-report:${session.userId}`}))::text`;
      const mute = await tx.chatMute.findUnique({ where: { userId: session.userId }, select: { until: true } });
      if (mute && mute.until > new Date()) return "muted";
      const message = await tx.chatMessage.findUnique({ where: { id: messageId }, select: { authorId: true, status: true, reviewedAt: true } });
      if (!message || message.status !== "visible") return "unavailable";
      if (message.authorId === session.userId) return "own_message";
      const daily = await tx.chatReport.count({ where: { reporterId: session.userId, createdAt: { gte: new Date(Date.now() - 86400000) } } });
      if (daily >= 5) return "rate_limit";
      const prior = await tx.chatReport.findUnique({ where: { messageId_reporterId: { messageId, reporterId: session.userId } } });
      if (prior) return "already_reported";
      await tx.chatReport.create({ data: { messageId, reporterId: session.userId, reason } });
      // A prior approval starts a new reporting window. Old reports must not
      // make one new report immediately undo a moderator's decision.
      const count = await tx.chatReport.count({ where: { messageId, ...(message.reviewedAt ? { createdAt: { gt: message.reviewedAt } } : {}) } });
      if (count >= 2) {
        await tx.chatMessage.update({ where: { id: messageId }, data: { status: "held", moderationNote: "reports" } });
        await tx.chatModerationEvent.create({ data: { messageId, userId: message.authorId, action: "reports_hold", detail: String(count) } });
      }
      return "reported";
    });
    if (result === "reported" || result === "already_reported") return NextResponse.json({ ok: true });
    return NextResponse.json({ error: result === "rate_limit" ? "Report limit reached for today." : result === "muted" ? "Your chat access is temporarily paused." : "This message cannot be reported." }, { status: result === "rate_limit" ? 429 : result === "muted" ? 403 : 400 });
  } catch (error) { logChatFailure("report", error); return NextResponse.json({ error: "Report could not be saved." }, { status: 503 }); }
}
