"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { trackLead } from "@/lib/conversions";
import { useLang, LangToggle, type Lang } from "@/components/LangProvider";
import SmartImage from "@/components/SmartImage";

const FEATURED_COUNTRIES = ["United States", "Canada", "Mexico", "Brazil", "Argentina", "Chile", "Colombia", "Peru", "Philippines", "Indonesia"];
const COUNTRIES = [
  "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Antigua and Barbuda", "Argentina", "Armenia", "Australia", "Austria",
  "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin", "Bhutan", "Bolivia",
  "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso", "Burundi", "Cabo Verde", "Cambodia",
  "Cameroon", "Canada", "Central African Republic", "Chad", "Chile", "China", "Colombia", "Comoros", "Congo (Brazzaville)",
  "Congo (Kinshasa)", "Costa Rica", "Cote d'Ivoire", "Croatia", "Cuba", "Cyprus", "Czechia", "Denmark", "Djibouti", "Dominica",
  "Dominican Republic", "Ecuador", "Egypt", "El Salvador", "Equatorial Guinea", "Eritrea", "Estonia", "Eswatini", "Ethiopia",
  "Fiji", "Finland", "France", "Gabon", "Gambia", "Georgia", "Germany", "Ghana", "Greece", "Grenada", "Guatemala", "Guinea",
  "Guinea-Bissau", "Guyana", "Haiti", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq",
  "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kiribati", "Kuwait", "Kyrgyzstan", "Laos",
  "Latvia", "Lebanon", "Lesotho", "Liberia", "Libya", "Liechtenstein", "Lithuania", "Luxembourg", "Macau", "Madagascar",
  "Malawi", "Malaysia", "Maldives", "Mali", "Malta", "Marshall Islands", "Mauritania", "Mauritius", "Mexico", "Micronesia",
  "Moldova", "Monaco", "Mongolia", "Montenegro", "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Netherlands",
  "New Zealand", "Nicaragua", "Niger", "Nigeria", "North Korea", "North Macedonia", "Norway", "Oman", "Pakistan", "Palau",
  "Palestine", "Panama", "Papua New Guinea", "Paraguay", "Peru", "Philippines", "Poland", "Portugal", "Qatar", "Romania",
  "Russia", "Rwanda", "Saint Kitts and Nevis", "Saint Lucia", "Saint Vincent and the Grenadines", "Samoa", "San Marino",
  "Sao Tome and Principe", "Saudi Arabia", "Senegal", "Serbia", "Seychelles", "Sierra Leone", "Singapore", "Slovakia",
  "Slovenia", "Solomon Islands", "Somalia", "South Africa", "South Korea", "South Sudan", "Spain", "Sri Lanka", "Sudan",
  "Suriname", "Sweden", "Switzerland", "Syria", "Taiwan", "Tajikistan", "Tanzania", "Thailand", "Timor-Leste", "Togo", "Tonga",
  "Trinidad and Tobago", "Tunisia", "Turkey", "Turkmenistan", "Tuvalu", "Uganda", "Ukraine", "United Arab Emirates",
  "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Vanuatu", "Vatican City", "Venezuela", "Vietnam", "Yemen",
  "Zambia", "Zimbabwe",
];

// Language-independent prize art (index-matched with COPY[lang].prizes).
const PRIZE_META = [
  { img: "/giveaway/le-sserafim.jpg", accent: "var(--sakura)" },
  { img: "/giveaway/le-sserafim-merch.jpg", accent: "var(--volt)" },
];

type Copy = {
  eyebrow: string; heroPre: string; heroEm: string; heroPost: string; subhead: string; cta: string; referred: string;
  prizesLabel: string;
  prizes: { badge: string; title: string; sub: string }[];
  disclaimerPre: string; disclaimerLink: string; disclaimerPost: string;
  dates: { k: string; v: string }[];
  formTitle: string; formSubtitle: string;
  phFirst: string; phLast: string; phEmail: string;
  phCountry: string; phPostal: string;
  submit: string; submitting: string;
  errFields: string; errGeneric: string;
  finePre: string; fineLink: string; finePost: string;
  seeAll: string;
  entered: string; alreadyEntered: string;
  resultSubPre: string; resultSubBold: string; resultSubPost: string;
  referralLinkLabel: string; copy: string; copied: string; referralsSoFar: string;
  resultFinePre: string; resultFineLink: string; resultFinePost: string; allGiveaways: string;
};

const COPY: Record<Lang, Copy> = {
  en: {
    eyebrow: "Aegyo Arena × LE SSERAFIM",
    heroPre: "Win ", heroEm: "PUREFLOW", heroPost: " lower-bowl seats",
    subhead: "LE SSERAFIM live at the Prudential Center in Newark, NJ — Thursday, October 8, 2026. Enter to win two lower-bowl seats in Section D plus a private merch line.",
    cta: "Enter to win",
    referred: "A friend sent you — you're both in the running. 🖤",
    prizesLabel: "The prizes",
    prizes: [
      { badge: "Grand Prize", title: "Two lower-bowl seats + private merch line", sub: "Two (2) seats in Section D of the lower bowl at LE SSERAFIM's PUREFLOW tour, Prudential Center in Newark, NJ, on Thursday, October 8, 2026 — a raised, clear view of the stage — plus access to a private merch line. A $935 value." },
      { badge: "Runner-Up", title: "$200 in official LE SSERAFIM merch", sub: "One runner-up takes home $200 worth of official LE SSERAFIM merchandise, shipped to you." },
    ],
    disclaimerPre: "No purchase necessary. Open to entrants 18+. Winners must complete identity verification and accept the campaign terms to claim. See the ",
    disclaimerLink: "Official Rules", disclaimerPost: ".",
    dates: [
      { k: "Entries close", v: "Thu, Oct 1, 2026 · 11:59 PM ET" },
      { k: "Winners drawn", v: "Friday, Oct 2, 2026" },
      { k: "Outreach begins", v: "Friday, Oct 2, 2026" },
      { k: "Concert", v: "Thursday, Oct 8, 2026 — 7:30 PM" },
    ],
    formTitle: "Enter the giveaway",
    formSubtitle: "One entry per person. We'll email you if you win — and add you to the Aegyo Arena newsletter for the next drop.",
    phFirst: "First name", phLast: "Last name", phEmail: "Email address",
    phCountry: "Country", phPostal: "Postal code",
    submit: "Enter to win", submitting: "Entering…",
    errFields: "Please complete all fields to enter.",
    errGeneric: "Something went wrong. Please try again.",
    finePre: "By entering you confirm you are 18+ and agree to the ",
    fineLink: "Official Rules", finePost: " and to receive email from Aegyo Arena.",
    seeAll: "← See all Aegyo Arena giveaways",
    entered: "You're in!", alreadyEntered: "You're already entered!",
    resultSubPre: "Winners are drawn ", resultSubBold: "Friday, October 2, 2026", resultSubPost: ". Share your link below — every friend who enters is another entry for you.",
    referralLinkLabel: "Your referral link", copy: "Copy", copied: "Copied!", referralsSoFar: "Referrals so far:",
    resultFinePre: "By entering you agree to the ", resultFineLink: "Official Rules", resultFinePost: ". Winners must be 18+, complete identity verification, and accept the campaign terms to claim.",
    allGiveaways: "← All giveaways",
  },
  es: {
    eyebrow: "Aegyo Arena × LE SSERAFIM",
    heroPre: "Gana asientos en el nivel bajo de ", heroEm: "PUREFLOW", heroPost: "",
    subhead: "LE SSERAFIM en vivo en el Prudential Center de Newark, NJ — jueves 8 de octubre de 2026. Participa para ganar dos asientos en el nivel bajo, Sección D, más una fila de merch privada.",
    cta: "Participa ahora",
    referred: "Un amigo te invitó — ambos están participando. 🖤",
    prizesLabel: "Los premios",
    prizes: [
      { badge: "Premio mayor", title: "Dos asientos en el nivel bajo + fila de merch privada", sub: "Dos (2) asientos en la Sección D del nivel bajo para la gira PUREFLOW de LE SSERAFIM en el Prudential Center de Newark, NJ el jueves 8 de octubre de 2026 — en alto y con vista despejada al escenario — más acceso a una fila de merch privada. Un valor de $935." },
      { badge: "Premio secundario", title: "$200 en merch oficial de LE SSERAFIM", sub: "Un ganador secundario se lleva $200 en mercancía oficial de LE SSERAFIM, enviada a tu domicilio." },
    ],
    disclaimerPre: "No es necesario comprar. Abierto a mayores de 18 años. Los ganadores deben completar la verificación de identidad y aceptar los términos de la campaña para reclamar. Consulta las ",
    disclaimerLink: "Reglas Oficiales", disclaimerPost: ".",
    dates: [
      { k: "Cierre de inscripciones", v: "jue 1 de octubre de 2026 · 11:59 PM ET" },
      { k: "Sorteo de ganadores", v: "viernes 2 de octubre de 2026" },
      { k: "Inicio de contacto", v: "viernes 2 de octubre de 2026" },
      { k: "Concierto", v: "jueves 8 de octubre de 2026 — 7:30 PM" },
    ],
    formTitle: "Participa en el sorteo",
    formSubtitle: "Una participación por persona. Te enviaremos un correo si ganas — y te añadiremos al boletín de Aegyo Arena para el próximo sorteo.",
    phFirst: "Nombre", phLast: "Apellido", phEmail: "Correo electrónico",
    phCountry: "País", phPostal: "Código postal",
    submit: "Participar", submitting: "Enviando…",
    errFields: "Por favor completa todos los campos para participar.",
    errGeneric: "Algo salió mal. Inténtalo de nuevo.",
    finePre: "Al participar confirmas que eres mayor de 18 años y aceptas las ",
    fineLink: "Reglas Oficiales", finePost: " y recibir correos de Aegyo Arena.",
    seeAll: "← Ver todos los sorteos de Aegyo Arena",
    entered: "¡Ya estás participando!", alreadyEntered: "¡Ya te habías registrado!",
    resultSubPre: "El sorteo de ganadores es el ", resultSubBold: "viernes 2 de octubre de 2026", resultSubPost: ". Comparte tu enlace abajo — cada amigo que participe es otra participación para ti.",
    referralLinkLabel: "Tu enlace de invitación", copy: "Copiar", copied: "¡Copiado!", referralsSoFar: "Invitaciones hasta ahora:",
    resultFinePre: "Al participar aceptas las ", resultFineLink: "Reglas Oficiales", resultFinePost: ". Los ganadores deben ser mayores de 18 años, completar la verificación de identidad y aceptar los términos de la campaña para reclamar.",
    allGiveaways: "← Todos los sorteos",
  },
};

export default function LeSserafimGiveaway() {
  const { lang } = useLang();
  const c = COPY[lang];

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [zip, setZip] = useState("");
  const [country, setCountry] = useState("");
  const [ref, setRef] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ referralLink: string; referralCount: number; alreadyEntered?: boolean } | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("ref");
    if (r) setRef(r);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!firstName || !lastName || !email || !country || !zip) {
      setError(c.errFields); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/le-sserafim", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ firstName, lastName, email, zip, country, ref }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? c.errGeneric); return; }
      if (!data.alreadyEntered) trackLead(data.rdtConversionId);
      setResult({ referralLink: data.referralLink, referralCount: data.referralCount ?? 0, alreadyEntered: data.alreadyEntered });
    } catch {
      setError(c.errGeneric);
    } finally {
      setSubmitting(false);
    }
  }

  function copyLink() {
    if (!result) return;
    navigator.clipboard?.writeText(result.referralLink).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  }

  const field: React.CSSProperties = { width: "100%", padding: "13px 16px", border: "1px solid var(--border-strong)", borderRadius: 8, fontSize: "1rem", outline: "none", background: "#fff", color: "#000", boxSizing: "border-box" };
  const sel: React.CSSProperties = { ...field, padding: "13px 8px", flex: 1, minWidth: 0 };

  if (result) {
    return (
      <main style={{ padding: "56px 24px 80px" }}>
        <div style={{ maxWidth: 540, margin: "0 auto", textAlign: "center" }}>
          <div style={{ fontSize: "3rem", marginBottom: 10 }}>🖤</div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: "2.2rem", color: "var(--ink)", marginBottom: 10 }}>
            {result.alreadyEntered ? c.alreadyEntered : c.entered}
          </h1>
          <p style={{ color: "var(--ink-dim)", fontSize: "1.05rem", lineHeight: 1.6, marginBottom: 28 }}>
            {c.resultSubPre}<strong style={{ color: "var(--ink)" }}>{c.resultSubBold}</strong>{c.resultSubPost}
          </p>
          <div style={{ background: "var(--bg-card)", border: "1px solid var(--sakura)", borderRadius: 14, padding: 22, textAlign: "left" }}>
            <div style={{ fontFamily: "var(--mono)", fontSize: "0.7rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--sakura)", marginBottom: 10 }}>{c.referralLinkLabel}</div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input readOnly value={result.referralLink} style={{ ...field, flex: 1, minWidth: 200, fontSize: "0.88rem" }} onFocus={(e) => e.currentTarget.select()} />
              <button type="button" onClick={copyLink} style={{ padding: "13px 20px", borderRadius: 8, border: "none", background: "var(--sakura)", color: "var(--on-accent)", fontWeight: 700, fontSize: "0.85rem", cursor: "pointer" }}>
                {copied ? c.copied : c.copy}
              </button>
            </div>
            <div style={{ marginTop: 14, fontSize: "0.9rem", color: "var(--ink-dim)" }}>
              {c.referralsSoFar} <strong style={{ color: "var(--sakura)" }}>{result.referralCount}</strong> / 50
            </div>
          </div>
          <p style={{ marginTop: 20, fontSize: "0.78rem", color: "var(--ink-faint)", lineHeight: 1.6 }}>
            {c.resultFinePre}
            <Link href="/le-sserafim-terms" style={{ color: "var(--sakura)", fontWeight: 600 }}>{c.resultFineLink}</Link>{c.resultFinePost}
          </p>
          <p style={{ marginTop: 20 }}>
            <Link href="/giveaways" style={{ color: "var(--ink-dim)", fontWeight: 600, fontSize: "0.9rem" }}>{c.allGiveaways}</Link>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main style={{ padding: "0 0 72px" }}>
      {/* Hero */}
      <section style={{ background: "linear-gradient(180deg, var(--sakura-light), var(--bg))", borderBottom: "1px solid var(--border)", padding: "40px 24px 48px", textAlign: "center" }}>
        <div style={{ maxWidth: 760, margin: "0 auto" }}>
          <LangToggle />
          <div style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", letterSpacing: "0.2em", textTransform: "uppercase", color: "var(--sakura)", marginBottom: 16 }}>{c.eyebrow}</div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: "clamp(2.4rem, 9vw, 4rem)", fontWeight: 700, color: "var(--ink)", margin: "0 0 14px", lineHeight: 1.05 }}>
            {c.heroPre}<em style={{ color: "var(--sakura)", fontStyle: "italic" }}>{c.heroEm}</em>{c.heroPost}
          </h1>
          <p style={{ color: "var(--ink-dim)", fontSize: "clamp(1rem, 3.5vw, 1.15rem)", lineHeight: 1.6, maxWidth: 560, margin: "0 auto 24px" }}>
            {c.subhead}
          </p>
          <div style={{ position: "relative", width: "100%", maxWidth: 560, margin: "0 auto 26px", aspectRatio: "651 / 557", borderRadius: 18, overflow: "hidden", border: "1px solid var(--border)" }}>
            <SmartImage src="/giveaway/le-sserafim.jpg" alt="LE SSERAFIM — PUREFLOW tour" fill sizes="(max-width: 760px) 100vw, 560px" style={{ objectFit: "cover" }} priority />
          </div>
          <a href="#enter" style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "14px 34px", borderRadius: 100, background: "var(--sakura)", color: "var(--on-accent)", fontWeight: 800, fontSize: "0.95rem", letterSpacing: "0.03em", textTransform: "uppercase", textDecoration: "none" }}>
            {c.cta}
          </a>
          {ref && <p style={{ marginTop: 16, fontSize: "0.85rem", color: "var(--volt)" }}>{c.referred}</p>}
        </div>
      </section>

      {/* Prizes */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "44px 24px 8px" }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: "0.72rem", letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--sakura)", marginBottom: 18 }}>{c.prizesLabel}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(300px, 100%), 1fr))", gap: 20 }}>
          {PRIZE_META.map((m, i) => {
            const p = c.prizes[i];
            return (
              <div key={i} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 18, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 10", overflow: "hidden" }}>
                  <SmartImage src={m.img} alt={p.title} fill sizes="(max-width: 760px) 100vw, 500px" style={{ objectFit: "cover" }} />
                  <span style={{ position: "absolute", top: 14, left: 14, background: "rgba(15,15,18,0.82)", color: "#fff", fontFamily: "var(--mono)", fontSize: "0.66rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", padding: "6px 12px", borderRadius: 100, border: `1px solid ${m.accent}` }}>{p.badge}</span>
                </div>
                <div style={{ padding: "20px 22px 24px" }}>
                  <h2 style={{ fontFamily: "var(--serif)", fontSize: "1.5rem", fontWeight: 700, color: "var(--ink)", margin: "0 0 8px", lineHeight: 1.2 }}>{p.title}</h2>
                  <p style={{ color: "var(--ink-dim)", fontSize: "0.92rem", lineHeight: 1.6, margin: 0 }}>{p.sub}</p>
                </div>
              </div>
            );
          })}
        </div>
        <p style={{ marginTop: 16, fontSize: "0.74rem", color: "var(--ink-faint)", lineHeight: 1.6 }}>
          {c.disclaimerPre}
          <Link href="/le-sserafim-terms" style={{ color: "var(--sakura)", fontWeight: 600 }}>{c.disclaimerLink}</Link>{c.disclaimerPost}
        </p>
      </section>

      {/* Key dates */}
      <section style={{ maxWidth: 1040, margin: "0 auto", padding: "28px 24px 0" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: 14 }}>
          {c.dates.map((d) => (
            <div key={d.k} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 14, padding: "16px 18px" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: "0.66rem", letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--sakura)", marginBottom: 6 }}>{d.k}</div>
              <div style={{ color: "var(--ink)", fontWeight: 700, fontSize: "0.98rem" }}>{d.v}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Entry form */}
      <section id="enter" style={{ maxWidth: 560, margin: "0 auto", padding: "40px 24px 0", scrollMarginTop: 24 }}>
        <h2 style={{ fontFamily: "var(--serif)", fontSize: "clamp(1.7rem, 5vw, 2.2rem)", fontWeight: 700, color: "var(--ink)", textAlign: "center", margin: "0 0 8px" }}>{c.formTitle}</h2>
        <p style={{ textAlign: "center", color: "var(--ink-dim)", fontSize: "0.98rem", lineHeight: 1.6, marginBottom: 28 }}>
          {c.formSubtitle}
        </p>
        <form onSubmit={submit} style={{ background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: 16, padding: "28px 24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <input style={field} placeholder={c.phFirst} value={firstName} onChange={(e) => setFirstName(e.target.value)} aria-label={c.phFirst} />
            <input style={field} placeholder={c.phLast} value={lastName} onChange={(e) => setLastName(e.target.value)} aria-label={c.phLast} />
            <input style={field} type="email" placeholder={c.phEmail} value={email} onChange={(e) => setEmail(e.target.value)} aria-label={c.phEmail} />
            <div style={{ display: "flex", gap: 8 }}>
              <select style={{ ...sel, flex: "1 1 45%" }} value={country} onChange={(e) => setCountry(e.target.value)} aria-label={c.phCountry}>
                <option value="">{c.phCountry}</option>
                {FEATURED_COUNTRIES.map((cn) => <option key={`f-${cn}`} value={cn}>{cn}</option>)}
                <option value="" disabled>──────────</option>
                {COUNTRIES.map((cn) => <option key={cn} value={cn}>{cn}</option>)}
              </select>
              <input style={{ ...field, flex: "1 1 55%", minWidth: 0 }} autoComplete="postal-code" placeholder={c.phPostal} value={zip} onChange={(e) => setZip(e.target.value)} aria-label={c.phPostal} />
            </div>
          </div>
          {error && (
            <div role="alert" style={{ marginTop: 16, color: "#ff5a5a", fontSize: "0.9rem", fontWeight: 600, lineHeight: 1.5 }}>
              {error}
            </div>
          )}
          <button type="submit" disabled={submitting} style={{ width: "100%", marginTop: 20, padding: "15px", borderRadius: 10, border: "none", background: submitting ? "var(--border-strong)" : "var(--sakura)", color: "var(--on-accent)", fontWeight: 800, fontSize: "0.95rem", letterSpacing: "0.04em", textTransform: "uppercase", cursor: submitting ? "not-allowed" : "pointer" }}>
            {submitting ? c.submitting : c.submit}
          </button>
          <p style={{ marginTop: 16, fontSize: "0.78rem", color: "var(--ink-faint)", textAlign: "center", lineHeight: 1.6 }}>
            {c.finePre}
            <Link href="/le-sserafim-terms" style={{ color: "var(--sakura)", fontWeight: 600 }}>{c.fineLink}</Link>{c.finePost}
          </p>
        </form>
        <p style={{ marginTop: 22, textAlign: "center" }}>
          <Link href="/giveaways" style={{ color: "var(--ink-dim)", fontWeight: 600, fontSize: "0.9rem" }}>{c.seeAll}</Link>
        </p>
      </section>
    </main>
  );
}
