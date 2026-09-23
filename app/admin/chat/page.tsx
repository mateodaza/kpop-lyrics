import Link from "next/link";
import { getChatSession } from "@/lib/chat-auth";
import { getRole } from "@/lib/access";
import { rankOf, RANK } from "@/lib/roles";
import { prisma } from "@/lib/prisma";
import ChatReview from "@/components/ChatReview";

export const dynamic = "force-dynamic";
export const metadata = { title: "Chat review — Aegyo Arena", robots: { index: false, follow: false } };

export default async function ChatAdminPage() {
  const session = await getChatSession();
  const role = session ? await getRole(session.user) : "public";
  if (rankOf(role) < RANK.moderator) return <main className="chat-review-page"><h1>Chat review</h1><p>Moderator access is required.</p><Link href="/admin">Back to admin</Link></main>;
  const messages = await prisma.chatMessage.findMany({
    where: { OR: [{ status: "held" }, { status: "visible", reviewedAt: null, reports: { some: {} } }] },
    include: { reports: { select: { reason: true, createdAt: true } } },
    orderBy: { createdAt: "asc" }, take: 100,
  });
  const items = messages.map((message) => ({
    id: message.id, body: message.body, author: message.authorName,
    status: message.status, reason: message.moderationNote, createdAt: message.createdAt.toISOString(),
    reports: message.reports.map((report) => report.reason),
  }));
  return <main className="chat-review-page"><Link href="/admin">← Admin</Link><h1>Chat review</h1><p>Held messages are private until approved. Review reported messages here too.</p><ChatReview initialItems={items} /></main>;
}
