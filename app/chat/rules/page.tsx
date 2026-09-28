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
      <li><T en="You must be at least 16 to post. Messages are publicly readable." es="Debes tener al menos 16 años para publicar. Los mensajes son públicos y cualquiera puede leerlos." /></li>
      <li><T en="Be kind to fans and artists. No harassment, hate, threats, sexual content, or encouragement of self-harm." es="Trata con respeto a fans y artistas. No se permite el acoso, odio, amenazas, contenido sexual ni incitar a autolesiones." /></li>
      <li><T en="Keep yourself and others safe. Do not share private details, contact information, links, or someone else's identity." es="Cuida tu seguridad y la de los demás. No compartas datos privados, información de contacto, enlaces ni la identidad de otra persona." /></li>
      <li><T en="No spam, repeated promotions, impersonation, or attempts to evade moderation." es="No se permite spam, promociones repetidas, suplantación ni intentos de evadir la moderación." /></li>
      <li><T en="Messages are public under your display name. Automated screening may hold a message for review; signed-in members can report messages, and moderators may remove messages or restrict chat access. Do not use chat for emergencies." es="Los mensajes son públicos bajo tu nombre visible. El filtro automático puede retener un mensaje para revisión; los miembros que hayan iniciado sesión pueden reportar mensajes y los moderadores pueden eliminar mensajes o restringir el acceso al chat. No uses el chat para emergencias." /></li>
    </ol>
    <p><T en="Messages leave public chat after 30 days. A daily cleanup deletes ordinary messages after 30 days and held or reported messages after 90 days. See our" es="Los mensajes desaparecen del chat público después de 30 días. Una limpieza diaria elimina los mensajes normales después de 30 días y los retenidos o reportados después de 90 días. Consulta nuestra" /> <Link href="/privacy-policy"><T en="Privacy Policy" es="Política de Privacidad" /></Link>.</p>
    <p><T en="To report an unsafe message without an account, raise an urgent safety concern, or appeal a chat moderation decision, email" es="Para reportar un mensaje inseguro sin cuenta, comunicar una preocupación urgente de seguridad o apelar una decisión de moderación, escribe a" /> <a href="mailto:privacy@aegyoarena.com?subject=Aegyo%20fan%20chat%20safety">privacy@aegyoarena.com</a>. <T en="Include the message, approximate time, and your account email if relevant. Do not email us passwords or login codes. For an immediate emergency, contact local emergency services." es="Incluye el mensaje, la hora aproximada y el correo de tu cuenta si corresponde. No nos envíes contraseñas ni códigos de acceso. En una emergencia inmediata, contacta a los servicios de emergencia locales." /></p>
    <p className="chat-terms-version"><T en="Chat terms version" es="Versión de las reglas" /> {CHAT_RULES_VERSION}</p>
  </main>;
}
