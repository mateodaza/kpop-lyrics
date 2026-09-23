import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getChatSession } from "@/lib/chat-auth";
import { chatDisplayName, classifyChatBody, sameOrigin, validateChatBody } from "@/lib/chat-policy";

export const dynamic = "force-dynamic";

function publicMessage(message: {
  id: string; body: string; createdAt: Date; authorName: string;
}) {
  return { id: message.id, body: message.body, createdAt: message.createdAt.toISOString(), authorName: message.authorName };
}

export async function GET() {
  if (process.env.AEGYO_CHAT_ENABLED !== "true") return NextResponse.json({ error: "Chat is not enabled." }, { status: 404 });
  try {
    const messages = await prisma.chatMessage.findMany({
      where: { status: "visible", createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      select: { id: true, body: true, createdAt: true, authorName: true },
      orderBy: { createdAt: "desc" }, take: 60,
    });
    return NextResponse.json({ messages: messages.reverse().map(publicMessage) }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Chat is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  if (process.env.AEGYO_CHAT_ENABLED !== "true") return NextResponse.json({ error: "Chat is not enabled." }, { status: 404 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getChatSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in with Aegyo Accounts to chat." }, { status: 401 });
  }
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ error: "Chat posting is temporarily unavailable." }, { status: 503 });
  if (Number(request.headers.get("content-length") ?? 0) > 2048) {
    return NextResponse.json({ error: "Message is too long." }, { status: 413 });
  }
  const input = await request.json().catch(() => null) as { body?: unknown } | null;
  const checked = validateChatBody(input?.body);
  if (!checked.ok) return NextResponse.json({ error: checked.error }, { status: 422 });

  // The locks make per-user and site-wide limits consistent across workers.
  const now = new Date();
  try {
    const reservation = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext('aegyo-chat-global'))::text`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${session.userId}))::text`;
      const mute = await tx.chatMute.findUnique({ where: { userId: session.userId }, select: { until: true } });
      if (mute && mute.until > now) return { kind: "muted" } as const;
      const globalMinute = await tx.chatPostAttempt.count({ where: { createdAt: { gte: new Date(now.getTime() - 60000) } } });
      const globalFiveMinutes = await tx.chatPostAttempt.count({ where: { createdAt: { gte: new Date(now.getTime() - 300000) } } });
      if (globalMinute >= 120 || globalFiveMinutes >= 500) return { kind: "global_limit" } as const;
      const recent = await tx.chatPostAttempt.findMany({
        where: { userId: session.userId, createdAt: { gte: new Date(now.getTime() - 86400000) } },
        select: { createdAt: true, bodyHash: true, outcome: true }, orderBy: { createdAt: "desc" }, take: 64,
      });
      const failedRecent = recent.filter((a) => a.outcome === "failed" && now.getTime() - a.createdAt.getTime() < 300000);
      if (failedRecent.length >= 3) return { kind: "retry_limit" } as const;
      const active = recent.filter((a) => a.outcome !== "failed");
      if (active.some((a) => now.getTime() - a.createdAt.getTime() < 8000)) return { kind: "slow_down" } as const;
      if (active.filter((a) => now.getTime() - a.createdAt.getTime() < 300000).length >= 8 || active.length >= 60) return { kind: "rate_limit" } as const;
      if (active.some((a) => a.bodyHash === checked.bodyHash)) return { kind: "duplicate" } as const;
      const attempt = await tx.chatPostAttempt.create({ data: { userId: session.userId, bodyHash: checked.bodyHash }, select: { id: true } });
      return { kind: "reserved", id: attempt.id } as const;
    });
    if (reservation.kind !== "reserved") {
      return NextResponse.json({ error: reservation.kind === "muted" ? "Your chat access is temporarily paused." : reservation.kind === "duplicate" ? "You already sent that message today." : "Chat is busy. Please try again later." }, { status: reservation.kind === "muted" ? 403 : 429 });
    }
    const authorName = chatDisplayName(session.user.displayName);
    let status: "visible" | "held";
    try { status = await classifyChatBody(checked.body); }
    catch {
      await prisma.chatPostAttempt.update({ where: { id: reservation.id }, data: { outcome: "failed" } }).catch(() => undefined);
      return NextResponse.json({ error: "Safety check is unavailable. Please try again later." }, { status: 503 });
    }
    const message = await prisma.$transaction(async (tx) => {
      const created = await tx.chatMessage.create({
        data: { authorId: session.userId, authorName, body: checked.body, status, moderationNote: status === "held" ? "classifier" : null },
        select: { id: true, body: true, createdAt: true, authorName: true },
      });
      await tx.chatPostAttempt.update({ where: { id: reservation.id }, data: { outcome: status } });
      if (status === "held") await tx.chatModerationEvent.create({ data: { messageId: created.id, userId: session.userId, action: "classifier_hold" } });
      return created;
    });
    return NextResponse.json({ status, message: status === "visible" ? publicMessage(message) : null }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Chat is temporarily unavailable." }, { status: 503 });
  }
}
