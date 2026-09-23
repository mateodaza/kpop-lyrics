import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChatSession } from "@/lib/chat-auth";
import { sameOrigin } from "@/lib/chat-policy";

const reasons = new Set(["abuse", "sexual", "spam", "personal_info", "other"]);

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getChatSession();
  if (!session) return NextResponse.json({ error: "Sign in with Aegyo Accounts to report a message." }, { status: 401 });
  const input = await request.json().catch(() => null) as { messageId?: unknown; reason?: unknown } | null;
  const messageId = typeof input?.messageId === "string" ? input.messageId : "";
  const reason = typeof input?.reason === "string" ? input.reason : "";
  if (!messageId || messageId.length > 40 || !reasons.has(reason)) return NextResponse.json({ error: "Choose a report reason." }, { status: 400 });
  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${messageId}))::text`;
      const message = await tx.chatMessage.findUnique({ where: { id: messageId }, select: { authorId: true, status: true } });
      if (!message || message.status !== "visible") return "unavailable";
      if (message.authorId === session.userId) return "own_message";
      const daily = await tx.chatReport.count({ where: { reporterId: session.userId, createdAt: { gte: new Date(Date.now() - 86400000) } } });
      if (daily >= 5) return "rate_limit";
      const prior = await tx.chatReport.findUnique({ where: { messageId_reporterId: { messageId, reporterId: session.userId } } });
      if (prior) return "already_reported";
      await tx.chatReport.create({ data: { messageId, reporterId: session.userId, reason } });
      const count = await tx.chatReport.count({ where: { messageId } });
      await tx.chatMessage.update({ where: { id: messageId }, data: count >= 2 ? { status: "held", moderationNote: "reports", reviewedAt: null, reviewedById: null } : { reviewedAt: null, reviewedById: null } });
      return "reported";
    });
    if (result === "reported" || result === "already_reported") return NextResponse.json({ ok: true });
    return NextResponse.json({ error: result === "rate_limit" ? "Report limit reached for today." : "This message cannot be reported." }, { status: result === "rate_limit" ? 429 : 400 });
  } catch { return NextResponse.json({ error: "Report could not be saved." }, { status: 503 }); }
}
