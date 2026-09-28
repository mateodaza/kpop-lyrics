import type { Metadata } from "next";
import Link from "next/link";
import { T, LangToggle } from "@/components/LangProvider";

export const metadata: Metadata = {
  title: "LE SSERAFIM Giveaway - Official Rules | Aegyo Arena",
  description: "Summary rules for the Aegyo Arena LE SSERAFIM PUREFLOW concert ticket giveaway.",
};

const wrap: React.CSSProperties = { maxWidth: 760, margin: "0 auto", padding: "48px 24px 80px", color: "var(--ink-dim)", lineHeight: 1.7 };
const h2s: React.CSSProperties = { fontFamily: "var(--serif)", fontSize: "1.3rem", color: "var(--ink)", margin: "30px 0 10px" };

function H2({ en, es }: { en: string; es: string }) {
  return <h2 style={h2s}><T en={en} es={es} /></h2>;
}

export default function LeSserafimTerms() {
  return (
    <main style={wrap}>
      <LangToggle />
      <div style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--sakura)", margin: "12px 0" }}>Aegyo Arena × LE SSERAFIM</div>
      <h1 style={{ fontFamily: "var(--serif)", fontSize: "2.4rem", color: "var(--ink)", margin: "0 0 6px" }}>
        <T en="Giveaway Rules" es="Reglas del sorteo" />
      </h1>
      <p style={{ fontSize: "0.85rem", color: "var(--ink-faint)" }}>
        <T en="Summary of terms - full Official Rules to be posted before the draw." es="Resumen de los términos - las Reglas Oficiales completas se publicarán antes del sorteo." />
      </p>

      <div style={{ background: "var(--sakura-light)", border: "1px solid var(--sakura)", borderRadius: 12, padding: "14px 18px", margin: "18px 0", fontSize: "0.88rem", color: "var(--ink)" }}>
        <T
          en="NO PURCHASE NECESSARY. A purchase will not increase your chances of winning. Void where prohibited."
          es="NO ES NECESARIO COMPRAR. Comprar no aumenta tus probabilidades de ganar. Nulo donde esté prohibido."
        />
      </div>

      <H2 en="The prizes" es="Los premios" />
      <p>
        <T
          en="One (1) grand-prize winner receives two (2) lower-bowl seats in Section D to LE SSERAFIM's PUREFLOW tour at the Prudential Center in Newark, NJ on Thursday, October 8, 2026, plus access to a private merch line (approximate retail value $935). One (1) runner-up receives $200 in official LE SSERAFIM merchandise. Prizes are non-transferable and may not be resold. No cash alternative except at the sponsor's discretion."
          es="Un (1) ganador del premio mayor recibe dos (2) asientos en la Sección D del nivel bajo para la gira PUREFLOW de LE SSERAFIM en el Prudential Center de Newark, NJ el jueves 8 de octubre de 2026, más acceso a una fila de merch privada (valor aproximado de $935). Un (1) ganador del segundo lugar recibe $200 en mercancía oficial de LE SSERAFIM. Los premios son intransferibles y no pueden revenderse. No hay alternativa en efectivo, salvo a discreción del patrocinador."
        />
      </p>

      <H2 en="Key dates" es="Fechas clave" />
      <p>
        <T
          en="Entries close Thursday, October 1, 2026 at 11:59 PM ET. Winners are drawn at random on Friday, October 2, 2026, and winner outreach begins the same day. Concert: Thursday, October 8, 2026 at 7:30 PM."
          es="Las inscripciones cierran el jueves 1 de octubre de 2026 a las 11:59 PM ET. Los ganadores se eligen al azar el viernes 2 de octubre de 2026, y el contacto con los ganadores comienza ese mismo día. Concierto: jueves 8 de octubre de 2026 a las 7:30 PM."
        />
      </p>

      <H2 en="Eligibility" es="Elegibilidad" />
      <p>
        <T
          en="Open to entrants who are 18 years of age or older at the time of entry. Winners must complete identity verification (KYC), be reachable and respond within the notification window, and accept the campaign terms in order to claim a prize. Eligibility is based on lawful residency and age, not citizenship. Void where prohibited by law."
          es="Abierto a participantes que tengan 18 años o más al momento de participar. Los ganadores deben completar la verificación de identidad (KYC), estar disponibles y responder dentro del plazo de notificación, y aceptar los términos de la campaña para reclamar un premio. La elegibilidad se basa en la residencia legal y la edad, no en la ciudadanía. Nulo donde lo prohíba la ley."
        />
      </p>

      <H2 en="How to enter" es="Cómo participar" />
      <p>
        <T en="Complete the entry form on the " es="Completa el formulario de participación en la " />
        <Link href="/le-sserafim-giveaway" style={{ color: "var(--sakura)", fontWeight: 600 }}><T en="giveaway page" es="página del sorteo" /></Link>
        <T
          en=" with accurate information. Limit one (1) entry per person. Optional referrals may earn additional entries as described on the giveaway page."
          es=" con información veraz. Límite de una (1) participación por persona. Las invitaciones opcionales pueden otorgar participaciones adicionales, como se describe en la página del sorteo."
        />
      </p>

      <H2 en="Winner selection & notification" es="Selección y notificación de ganadores" />
      <p>
        <T
          en="Winners are selected at random. Ranked reserve candidates are drawn so that if a selected winner is unreachable, declines, or fails verification, the prize passes to the next eligible candidate. Winners will be contacted using the details provided at entry."
          es="Los ganadores se seleccionan al azar. Se eligen candidatos de reserva ordenados de modo que, si un ganador seleccionado no está disponible, declina o no pasa la verificación, el premio pasa al siguiente candidato elegible. Se contactará a los ganadores con los datos proporcionados al participar."
        />
      </p>

      <H2 en="Privacy & marketing" es="Privacidad y marketing" />
      <p>
        <T
          en="By entering, you agree to receive email from Aegyo Arena and to the handling of your information as described in our "
          es="Al participar, aceptas recibir correos de Aegyo Arena y el tratamiento de tu información como se describe en nuestra "
        />
        <Link href="/privacy-policy" style={{ color: "var(--sakura)", fontWeight: 600 }}><T en="Privacy Policy" es="Política de Privacidad" /></Link>
        <T
          en=". Winners may be required to consent to the use of their name/likeness for campaign marketing and to any applicable tax reporting."
          es=". Es posible que se solicite a los ganadores su consentimiento para el uso de su nombre/imagen en el marketing de la campaña y para cualquier declaración fiscal aplicable."
        />
      </p>

      <p style={{ marginTop: 30 }}>
        <Link href="/le-sserafim-giveaway" style={{ color: "var(--sakura)", fontWeight: 700 }}><T en="← Back to the giveaway" es="← Volver al sorteo" /></Link>
      </p>
    </main>
  );
}
