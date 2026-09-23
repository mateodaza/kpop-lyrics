import { NextRequest, NextResponse } from "next/server";
import { getChatSession } from "@/lib/chat-auth";
import { getRole } from "@/lib/access";
import { rankOf, RANK, type Role } from "@/lib/roles";
import { sameOrigin } from "@/lib/chat-policy";
import { prisma } from "@/lib/prisma";
import { readChatJson } from "@/lib/chat-request";

export async function POST(request: NextRequest) {
  if (process.env.AEGYO_CHAT_ENABLED !== "true") return NextResponse.json({ error: "Chat is not enabled." }, { status: 404 });
  if (!sameOrigin(request)) return NextResponse.json({ error: "Invalid request origin." }, { status: 403 });
  const session = await getChatSession();
  if (!session) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const role = await getRole(session.user);
  if (rankOf(role) < RANK.moderator) return NextResponse.json({ error: "Moderator access required." }, { status: 403 });
  const parsed = await readChatJson(request, 512);
  if (parsed.tooLarge) return NextResponse.json({ error: "Invalid review request." }, { status: 413 });
  const input = parsed.value as { id?: unknown; decision?: unknown; userId?: unknown; reason?: unknown } | null;
  if (input?.decision === "mute" || input?.decision === "unmute") {
    const userId = typeof input.userId === "string" ? input.userId : "";
    if (!userId || userId.length > 40 || userId === session.userId) return NextResponse.json({ error: "Invalid user." }, { status: 400 });
    const reason = typeof input.reason === "string" ? input.reason.trim().slice(0, 200) : "";
    if (input.decision === "mute" && !reason) return NextResponse.json({ error: "A reason is required." }, { status: 400 });
    try {
      await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true, email: true } });
        if (!user) throw new Error("user_not_found");
        const targetRole = await tx.$queryRaw<Array<{ role: string | null }>>`SELECT "role" FROM "User" WHERE "id" = ${userId}`;
        if (user.email.toLowerCase() === process.env.OWNER_EMAIL?.toLowerCase() || rankOf(targetRole[0]?.role as Role) >= rankOf(role)) throw new Error("protected_user");
        if (input.decision === "mute") await tx.chatMute.upsert({ where: { userId }, create: { userId, until: new Date(Date.now() + 24 * 3600000), reason, actorId: session.userId }, update: { until: new Date(Date.now() + 24 * 3600000), reason, actorId: session.userId } });
        else await tx.chatMute.deleteMany({ where: { userId } });
        await tx.chatModerationEvent.create({ data: { userId, actorId: session.userId, action: input.decision as string, detail: reason || null } });
      });
      return NextResponse.json({ ok: true });
    } catch { return NextResponse.json({ error: "Mute change could not be saved." }, { status: 503 }); }
  }
  const id = typeof input?.id === "string" ? input.id : "";
  const decision = input?.decision === "visible" || input?.decision === "removed" ? input.decision : null;
  if (!id || id.length > 40 || !decision) return NextResponse.json({ error: "Invalid review decision." }, { status: 400 });
  try {
    const message = await prisma.$transaction(async (tx) => {
      const existing = await tx.chatMessage.findUnique({ where: { id }, select: { authorId: true } });
      if (!existing || (decision === "visible" && existing.authorId === session.userId && role !== "superadmin")) throw new Error("self_review_forbidden");
      const updated = await tx.chatMessage.update({
        where: { id },
        data: { status: decision, reviewedById: session.userId, reviewedAt: new Date(), moderationNote: decision === "removed" ? "operator" : null },
        select: { id: true, authorId: true },
      });
      await tx.chatModerationEvent.create({ data: { messageId: id, userId: updated.authorId, actorId: session.userId, action: decision === "removed" ? "remove" : "approve" } });
      return updated;
    });
    return NextResponse.json({ ok: true, id: message.id });
  } catch { return NextResponse.json({ error: "Review could not be saved." }, { status: 503 }); }
}
