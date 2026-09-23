import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: NextRequest) {
  const configured = process.env.CHAT_CLEANUP_SECRET;
  const supplied = request.headers.get("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!configured || !supplied || configured.length !== supplied.length ||
      !crypto.timingSafeEqual(Buffer.from(configured), Buffer.from(supplied))) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const thirtyDays = new Date(Date.now() - 30 * 86400000);
  const ninetyDays = new Date(Date.now() - 90 * 86400000);
  const oneDay = new Date(Date.now() - 86400000);
  try {
    const [messages, attempts] = await prisma.$transaction([
      prisma.chatMessage.deleteMany({ where: { OR: [
        { createdAt: { lt: ninetyDays } },
        { createdAt: { lt: thirtyDays }, status: { in: ["visible", "removed"] }, reports: { none: {} } },
      ] } }),
      prisma.chatPostAttempt.deleteMany({ where: { createdAt: { lt: oneDay } } }),
    ]);
    return NextResponse.json({ deletedMessages: messages.count, deletedAttempts: attempts.count });
  } catch { return NextResponse.json({ error: "Cleanup failed." }, { status: 503 }); }
}
