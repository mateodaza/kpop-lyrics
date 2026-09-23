import { NextRequest, NextResponse } from "next/server";
import { getChatSession } from "@/lib/chat-auth";
import { getRole } from "@/lib/access";
import { rankOf, RANK } from "@/lib/roles";
import { sameOrigin } from "@/lib/chat-policy";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getChatSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const role = await getRole(session.user);
  if (rankOf(role) < RANK.moderator) return NextResponse.json({ error: "Moderator access required." }, { status: 403 });
  const input = await request.json().catch(() => null) as { id?: unknown; decision?: unknown } | null;
  const id = typeof input?.id === "string" ? input.id : "";
  const decision = input?.decision === "visible" || input?.decision === "removed" ? input.decision : null;
  if (!id || id.length > 40 || !decision) return NextResponse.json({ error: "Invalid review decision." }, { status: 400 });
  try {
    const message = await prisma.chatMessage.update({
      where: { id },
      data: { status: decision, reviewedById: session.userId, reviewedAt: new Date(), moderationNote: decision === "removed" ? "operator" : null },
      select: { id: true },
    });
    return NextResponse.json({ ok: true, id: message.id });
  } catch { return NextResponse.json({ error: "Review could not be saved." }, { status: 503 }); }
}
