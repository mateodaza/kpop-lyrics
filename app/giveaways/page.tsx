import type { Metadata } from "next";
import Link from "next/link";
import SmartImage from "@/components/SmartImage";
import { T, LangToggle } from "@/components/LangProvider";

export const metadata: Metadata = {
  title: "Giveaways | Aegyo Arena",
  description: "Win K-pop concert tickets and merch with Aegyo Arena - LE SSERAFIM, BTS, and more. Free to enter.",
};

type L = { en: string; es: string };

type Card = {
  status: "open" | "closed" | "soon";
  artist: string;
  tour: L;
  img: string;
  accent: string;
  blurb: L;
  when: L;
  where: L;
  actions: { label: L; href: string; primary?: boolean }[];
};

const CARDS: Card[] = [
  {
    status: "open",
    artist: "LE SSERAFIM",
    tour: { en: "PUREFLOW Tour", es: "Gira PUREFLOW" },
    img: "/giveaway/le-sserafim.jpg",
    accent: "var(--sakura)",
    blurb: {
      en: "Win two lower-bowl seats in Section D + a private merch line, or $200 in official merch for the runner-up.",
      es: "Gana dos asientos en el nivel bajo, Sección D, + una fila de merch privada, o $200 en merch oficial para el segundo lugar.",
    },
    when: { en: "Concert: Thu, Oct 8, 2026", es: "Concierto: jue 8 de octubre de 2026" },
    where: { en: "Prudential Center - Newark, NJ", es: "Prudential Center - Newark, NJ" },
    actions: [{ label: { en: "Enter now", es: "Participa ahora" }, href: "/le-sserafim-giveaway", primary: true }],
  },
  {
    status: "closed",
    artist: "BTS",
    tour: { en: "Concert Ticket Giveaway", es: "Sorteo de boletos" },
    img: "/giveaway/tickets.jpg",
    accent: "var(--volt)",
    blurb: {
      en: "Entries are closed. See the provably-fair, Chainlink-verifiable winner selection.",
      es: "Las inscripciones están cerradas. Mira la selección de ganadores verificable con Chainlink.",
    },
    when: { en: "Winner selection complete", es: "Selección de ganadores completa" },
    where: { en: "Aegyo Arena", es: "Aegyo Arena" },
    actions: [
      { label: { en: "View giveaway", es: "Ver el sorteo" }, href: "/bts-giveaway" },
      { label: { en: "See the selection", es: "Ver la selección" }, href: "/bts-giveaway/draw", primary: true },
    ],
  },
  {
    status: "soon",
    artist: "aespa",
    tour: { en: "Next up", es: "Lo que viene" },
    img: "/giveaway/aespa.jpg",
    accent: "var(--ink-dim)",
    blurb: {
      en: "Our next drop: aespa concert tickets. Enter any giveaway above to join the newsletter and hear first.",
      es: "Nuestro próximo sorteo: boletos para aespa. Participa en cualquier sorteo de arriba para unirte al boletín y enterarte primero.",
    },
    when: { en: "Mon, Jan 26, 2027", es: "lun 26 de enero de 2027" },
    where: { en: "Berlin, Germany", es: "Berlín, Alemania" },
    actions: [],
  },
];

const STATUS_LABEL: Record<Card["status"], L> = {
  open: { en: "Open now", es: "Abierto" },
  closed: { en: "Closed", es: "Cerrado" },
  soon: { en: "Coming soon", es: "Próximamente" },
};

export default function GiveawaysPage() {
  return (
    <main style={{ padding: "0 0 80px" }}>
      <section style={{ background: "linear-gradient(180deg, var(--sakura-light), var(--bg))", borderBottom: "1px solid var(--border)", padding: "44px 24px 40px", textAlign: "center" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <LangToggle />
          <div style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--sakura)", marginBottom: 14 }}>
            <T en="Aegyo Arena Giveaways" es="Sorteos de Aegyo Arena" />
          </div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(2.2rem, 8vw, 3.6rem)", fontWeight: 700, color: "var(--ink)", margin: "0 0 14px", lineHeight: 1.05 }}>
            <T en="Win K-pop " es="Gana " /><em style={{ color: "var(--sakura)", fontStyle: "italic" }}><T en="concert tickets" es="boletos de K-pop" /></em>
          </h1>
          <p style={{ color: "var(--ink-dim)", fontSize: "clamp(1rem, 3.5vw, 1.15rem)", lineHeight: 1.6, maxWidth: 560, margin: "0 auto" }}>
            <T
              en="Free to enter. Real seats, real merch, provably-fair winner selection. Here's what's live now - and what's next."
              es="Participación gratuita. Asientos reales, merch real y selección de ganadores comprobablemente justa. Esto es lo que está activo ahora - y lo que viene."
            />
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "40px 24px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(320px, 100%), 1fr))", gap: 22 }}>
          {CARDS.map((card) => (
            <div key={card.artist} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 20, overflow: "hidden", display: "flex", flexDirection: "column", opacity: card.status === "soon" ? 0.92 : 1 }}>
              <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 10", overflow: "hidden", background: "var(--bg-light)" }}>
                <SmartImage src={card.img} alt={`${card.artist}`} fill sizes="(max-width: 760px) 100vw, 480px" style={{ objectFit: "cover", filter: card.status === "closed" ? "grayscale(0.35)" : undefined }} />
                <span style={{ position: "absolute", top: 14, left: 14, background: "rgba(15,15,18,0.82)", color: "#fff", fontFamily: "var(--mono)", fontSize: "0.64rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 100, border: `1px solid ${card.accent}` }}>
                  <T en={STATUS_LABEL[card.status].en} es={STATUS_LABEL[card.status].es} />
                </span>
              </div>
              <div style={{ padding: "20px 22px 24px", display: "flex", flexDirection: "column", flex: 1 }}>
                <div style={{ fontFamily: "var(--mono)", fontSize: "0.66rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--sakura)", marginBottom: 6 }}>
                  <T en={card.tour.en} es={card.tour.es} />
                </div>
                <h2 style={{ fontFamily: "var(--serif)", fontSize: "1.7rem", fontWeight: 700, color: "var(--ink)", margin: "0 0 10px", lineHeight: 1.15 }}>{card.artist}</h2>
                <p style={{ color: "var(--ink-dim)", fontSize: "0.92rem", lineHeight: 1.6, margin: "0 0 14px" }}>
                  <T en={card.blurb.en} es={card.blurb.es} />
                </p>
                <div style={{ fontSize: "0.85rem", color: "var(--ink-dim)", marginBottom: 18 }}>
                  <div>📅 <T en={card.when.en} es={card.when.es} /></div>
                  <div>📍 <T en={card.where.en} es={card.where.es} /></div>
                </div>
                <div style={{ marginTop: "auto", display: "flex", flexWrap: "wrap", gap: 10 }}>
                  {card.actions.length === 0
                    ? <span style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-faint)" }}><T en="Details soon" es="Detalles pronto" /></span>
                    : card.actions.map((a) => (
                      <Link key={a.href} href={a.href} style={{
                        display: "inline-flex", alignItems: "center", padding: "11px 22px", borderRadius: 100, fontWeight: 800, fontSize: "0.85rem", letterSpacing: "0.02em", textTransform: "uppercase", textDecoration: "none",
                        background: a.primary ? "var(--sakura)" : "transparent", color: a.primary ? "var(--on-accent)" : "var(--ink)", border: a.primary ? "none" : "1px solid var(--border-strong)",
                      }}><T en={a.label.en} es={a.label.es} /></Link>
                    ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
