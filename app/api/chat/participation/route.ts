import { NextRequest, NextResponse } from "next/server";
import { getChatSession } from "@/lib/chat-auth";
import { canWriteChatInEnvironment, sameOrigin } from "@/lib/chat-policy";
import { CHAT_RULES_VERSION, hasCurrentChatParticipation, validatesChatParticipationInput } from "@/lib/chat-participation";
import { prisma } from "@/lib/prisma";
import { readChatJson } from "@/lib/chat-request";
import { logChatFailure } from "@/lib/chat-logging";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.AEGYO_CHAT_ENABLED !== "true") return NextResponse.json({ error: "Chat is not enabled." }, { status: 404 });
  const session = await getChatSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canWriteChatInEnvironment(session.user.email)) return NextResponse.json({ error: "Chat access is limited to preview testers." }, { status: 403 });
  try {
    const participation = await prisma.chatParticipation.findUnique({ where: { userId: session.userId } });
    return NextResponse.json({ accepted: hasCurrentChatParticipation(participation), rulesVersion: CHAT_RULES_VERSION }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) { logChatFailure("participation_read", error); return NextResponse.json({ error: "Could not check chat access." }, { status: 503 }); }
}

export async function POST(request: NextRequest) {
  if (process.env.AEGYO_CHAT_ENABLED !== "true") return NextResponse.json({ error: "Chat is not enabled." }, { status: 404 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getChatSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (!canWriteChatInEnvironment(session.user.email)) return NextResponse.json({ error: "Chat access is limited to preview testers." }, { status: 403 });
  const parsed = await readChatJson(request, 256);
  if (parsed.tooLarge) return NextResponse.json({ error: "Invalid agreement." }, { status: 413 });
  const input = parsed.value;
  if (!validatesChatParticipationInput(input)) return NextResponse.json({ error: "Confirm both requirements to post." }, { status: 422 });
  try {
    const now = new Date();
    await prisma.chatParticipation.upsert({
      where: { userId: session.userId },
      create: { userId: session.userId, rulesVersion: CHAT_RULES_VERSION, acceptedAt: now, age16ConfirmedAt: now },
      update: { rulesVersion: CHAT_RULES_VERSION, acceptedAt: now, age16ConfirmedAt: now },
    });
    return NextResponse.json({ accepted: true, rulesVersion: CHAT_RULES_VERSION });
  } catch (error) { logChatFailure("participation_save", error); return NextResponse.json({ error: "Could not save chat agreement." }, { status: 503 }); }
}
