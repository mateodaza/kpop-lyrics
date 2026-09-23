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

  // The database lock makes limits consistent across workers and concurrent tabs.
  const now = new Date();
  try {
    const reservation = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${session.userId}))::text`;
      const recent = await tx.chatPostAttempt.findMany({
        where: { userId: session.userId, createdAt: { gte: new Date(now.getTime() - 86400000) } },
        select: { createdAt: true, bodyHash: true }, orderBy: { createdAt: "desc" }, take: 61,
      });
      if (recent.some((a) => now.getTime() - a.createdAt.getTime() < 8000)) return "slow_down";
      if (recent.filter((a) => now.getTime() - a.createdAt.getTime() < 300000).length >= 8 || recent.length >= 60) return "rate_limit";
      if (recent.some((a) => a.bodyHash === checked.bodyHash && now.getTime() - a.createdAt.getTime() < 86400000)) return "duplicate";
      await tx.chatPostAttempt.create({ data: { userId: session.userId, bodyHash: checked.bodyHash } });
      return "reserved";
    });
    if (reservation !== "reserved") {
      return NextResponse.json({ error: reservation === "duplicate" ? "You already sent that message today." : "You're sending messages too quickly. Please try again later." }, { status: 429 });
    }
    const authorName = chatDisplayName(session.user.displayName);
    let status: "visible" | "held";
    try { status = await classifyChatBody(`${authorName}: ${checked.body}`); }
    catch { return NextResponse.json({ error: "Safety check is unavailable. Please try again later." }, { status: 503 }); }
    const message = await prisma.chatMessage.create({
      data: { authorId: session.userId, authorName, body: checked.body, status, moderationNote: status === "held" ? "classifier" : null },
      select: { id: true, body: true, createdAt: true, authorName: true },
    });
    return NextResponse.json({ status, message: status === "visible" ? publicMessage(message) : null }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Chat is temporarily unavailable." }, { status: 503 });
  }
}
