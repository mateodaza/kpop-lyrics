import { notFound } from "next/navigation";
import { getSession } from "@/lib/auth";
import { hasAegyoAccountSession } from "@/lib/chat-policy";
import FanChatbox from "@/components/FanChatbox";
import { T } from "@/components/LangProvider";

export const dynamic = "force-dynamic";
export const metadata = { title: "Fan room — Aegyo Arena", description: "The Aegyo Arena fan room." };

export default async function ChatPage() {
  if (process.env.AEGYO_CHAT_ENABLED !== "true") notFound();
  const session = await getSession();
  return <main className="chat-page">
    <div className="chat-page-intro">
      <div><h1><T en="The fan room" es="La sala de fans" /></h1><p><T en="Comebacks, dance breaks, new favorites. Pull up a seat and talk K-pop with the fandom." es="Comebacks, bailes y nuevos favoritos. Entra y habla de K-pop con el fandom." /></p></div>
      <span className="chat-page-channel">#all-fans</span>
    </div>
    <FanChatbox canPost={hasAegyoAccountSession(session)} signedIn={!!session} fullPage />
  </main>;
}
