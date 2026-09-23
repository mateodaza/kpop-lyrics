import Link from "next/link";
import { T } from "@/components/LangProvider";
import { CHAT_RULES_VERSION } from "@/lib/chat-participation";

export const metadata = { title: "Fan chat terms — Aegyo Arena", robots: { index: false, follow: false } };

export default function ChatRulesPage() {
  return <main className="chat-terms-page">
    <Link href="/chat">← <T en="Back to the fan room" es="Volver a la sala de fans" /></Link>
    <h1><T en="Fan chat terms" es="Reglas del chat de fans" /></h1>
    <p><T en="A welcoming room works when every fan makes space for the next one. These rules apply to messages you post in Aegyo Arena fan chat." es="Una sala acogedora funciona cuando cada fan deja espacio para los demás. Estas reglas se aplican a los mensajes que publiques en el chat de fans de Aegyo Arena." /></p>
    <ol>
      <li><T en="You must be at least 16 to post. Younger fans may read the public chat but cannot contribute." es="Debes tener al menos 16 años para publicar. Los fans menores pueden leer el chat público, pero no participar." /></li>
      <li><T en="Be kind to fans and artists. No harassment, hate, threats, sexual content, or encouragement of self-harm." es="Trata con respeto a fans y artistas. No se permite el acoso, odio, amenazas, contenido sexual ni incitar a autolesiones." /></li>
      <li><T en="Keep yourself and others safe. Do not share private details, contact information, links, or someone else's identity." es="Cuida tu seguridad y la de los demás. No compartas datos privados, información de contacto, enlaces ni la identidad de otra persona." /></li>
      <li><T en="No spam, repeated promotions, impersonation, or attempts to evade moderation." es="No se permite spam, promociones repetidas, suplantación ni intentos de evadir la moderación." /></li>
      <li><T en="Messages are public under your display name. Automated screening may hold a message for review; people can report messages, and moderators may remove them or temporarily mute accounts. Do not use chat for emergencies." es="Los mensajes son públicos bajo tu nombre visible. El filtro automático puede retener un mensaje para revisión; las personas pueden reportar mensajes y los moderadores pueden eliminarlos o silenciar cuentas temporalmente. No uses el chat para emergencias." /></li>
    </ol>
    <p><T en="Messages leave public chat after 30 days. A daily cleanup deletes ordinary messages after 30 days and held or reported messages after 90 days. See our" es="Los mensajes desaparecen del chat público después de 30 días. Una limpieza diaria elimina los mensajes normales después de 30 días y los retenidos o reportados después de 90 días. Consulta nuestra" /> <Link href="/privacy-policy"><T en="Privacy Policy" es="Política de Privacidad" /></Link>.</p>
    <p className="chat-terms-version"><T en="Chat terms version" es="Versión de las reglas" /> {CHAT_RULES_VERSION}</p>
  </main>;
}
