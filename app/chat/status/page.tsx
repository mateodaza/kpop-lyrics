import Link from "next/link";
import { notFound } from "next/navigation";
import { T } from "@/components/LangProvider";
import { getChatSession } from "@/lib/chat-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const metadata = { title: "My chat status — Aegyo Arena", robots: { index: false, follow: false } };

function explanation(status: string, note: string | null): string {
  if (status === "held") return note === "classifier" ? "Held by automated safety screening for human review." : "Held after a safety report for human review.";
  if (note === "account_restricted") return "Removed when this account was restricted from chat.";
  return note ? `Removed by a moderator: ${note}` : "Removed by a moderator.";
}

export default async function ChatStatusPage() {
  if (process.env.AEGYO_CHAT_ENABLED !== "true") notFound();
  const session = await getChatSession();
  if (!session) return <main className="chat-terms-page"><h1><T en="My chat status" es="Mi estado en el chat" /></h1><p><T en="Sign in with your Aegyo account to see your chat decisions." es="Inicia sesión con tu cuenta Aegyo para ver las decisiones sobre tu chat." /></p><Link href="/login"><T en="Sign in" es="Iniciar sesión" /></Link></main>;
  const [messages, restriction] = await Promise.all([
    prisma.chatMessage.findMany({ where: { authorId: session.userId, status: { in: ["held", "removed"] }, createdAt: { gte: new Date(Date.now() - 90 * 86400000) } }, select: { id: true, body: true, status: true, moderationNote: true, createdAt: true, reviewedAt: true }, orderBy: { createdAt: "desc" }, take: 50 }),
    prisma.chatMute.findUnique({ where: { userId: session.userId }, select: { until: true, reason: true } }),
  ]);
  return <main className="chat-terms-page">
    <Link href="/chat">← <T en="Back to the fan room" es="Volver a la sala de fans" /></Link>
    <h1><T en="My chat status" es="Mi estado en el chat" /></h1>
    <p><T en="These are recent messages held or removed from public chat. A held message is private until a moderator decides whether to publish it." es="Estos son mensajes recientes retenidos o eliminados del chat público. Un mensaje retenido es privado hasta que un moderador decida si publicarlo." /></p>
    {restriction && restriction.until > new Date() && <p role="status"><strong><T en="Chat access restricted:" es="Acceso al chat restringido:" /></strong> {restriction.until.getUTCFullYear() === 9999 ? <T en="Indefinitely" es="Indefinidamente" /> : <time dateTime={restriction.until.toISOString()}>{restriction.until.toLocaleString()}</time>} · {restriction.reason}</p>}
    {messages.length === 0 ? <p><T en="No recent chat decisions to show." es="No hay decisiones recientes de chat para mostrar." /></p> : <ul>{messages.map((message) => <li key={message.id}>
      <strong>{message.status === "held" ? <T en="Waiting for review" es="Pendiente de revisión" /> : <T en="Removed" es="Eliminado" />}</strong> · <time dateTime={message.createdAt.toISOString()}>{message.createdAt.toLocaleString()}</time>
      <p>{message.body}</p><p>{explanation(message.status, message.moderationNote)}</p>
    </li>)}</ul>}
    <p><T en="To ask for a review or appeal, email" es="Para pedir una revisión o apelar, escribe a" /> <a href="mailto:privacy@aegyoarena.com?subject=Aegyo%20fan%20chat%20appeal">privacy@aegyoarena.com</a>. <T en="Include your account email and the message or date. Do not send passwords or login codes." es="Incluye el correo de tu cuenta y el mensaje o la fecha. No envíes contraseñas ni códigos de acceso." /></p>
  </main>;
}
