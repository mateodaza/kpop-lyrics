import Link from "next/link";
import { LangToggle, T } from "@/components/LangProvider";

export default function AuthCutoverMaintenance({ retryHref }: { retryHref: string }) {
  return (
    <main style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ width: "100%", maxWidth: 440, textAlign: "center" }}>
        <LangToggle align="center" marginBottom={16} />
        <div style={{ background: "var(--bg-card)", border: "8px solid #fff", borderRadius: 18, padding: "34px 30px", boxShadow: "0 18px 50px rgba(0,0,0,0.35)" }}>
          <div aria-hidden="true" style={{ fontSize: "2rem", marginBottom: 12 }}>💜</div>
          <h1 style={{ fontFamily: "var(--serif)", fontSize: "2rem", color: "var(--ink)", margin: "0 0 10px" }}>
            <T en="Accounts are briefly paused" es="Las cuentas están pausadas por un momento" />
          </h1>
          <p style={{ color: "var(--ink-dim)", lineHeight: 1.6, margin: "0 0 22px" }}>
            <T
              en="We're finishing a secure account update. Your account and activity are safe. Please try again in a minute."
              es="Estamos terminando una actualización segura de cuentas. Tu cuenta y actividad están protegidas. Inténtalo de nuevo en un minuto."
            />
          </p>
          <Link href={retryHref} className="btn-yellow" style={{ display: "inline-block", padding: "12px 24px", textDecoration: "none" }}>
            <T en="TRY AGAIN" es="INTENTAR DE NUEVO" />
          </Link>
        </div>
      </div>
    </main>
  );
}
