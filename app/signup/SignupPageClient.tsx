"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trackSignupPageView, trackAccountCreated } from "@/lib/conversions";
import { T, LangToggle, useT } from "@/components/LangProvider";
import SmartImage from "@/components/SmartImage";

/**
 * The signup API answers in English, so keep both languages on the error and let
 * <T> pick at render time — that way the message follows the toggle even after
 * it is on screen. Covers the strings app/api/auth/signup/route.ts can return
 * plus our local fallbacks; anything unrecognised falls through in English.
 */
const ES_ERRORS: Record<string, string> = {
  "Signup failed": "No se pudo crear la cuenta.",
  "Something went wrong. Please try again.": "Algo salió mal. Inténtalo de nuevo.",
  "Valid email required": "Ingresa un correo válido.",
  "Password must be at least 6 characters": "La contraseña debe tener al menos 6 caracteres.",
  "An account with this email already exists": "Ya existe una cuenta con este correo.",
};
const err = (en: string) => ({ en, es: ES_ERRORS[en] ?? en });

export default function SignupPage() {
  const router = useRouter();
  const t = useT();
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [subscribe, setSubscribe] = useState(true); // "email me K-pop rumors" opt-in
  const [error, setError] = useState<{ en: string; es: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Pageview conversion (GA4 / Reddit / TikTok / Taboola).
  useEffect(() => { trackSignupPageView(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName, subscribe }),
      });
      const data = await res.json();
      if (res.status === 409 && typeof data.redirect === "string") {
        window.location.assign(data.redirect);
        return;
      }
      if (!res.ok) { setError(err(data.error ?? "Signup failed")); return; }
      trackAccountCreated();
      const next = new URLSearchParams(window.location.search).get("next");
      router.push(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError(err("Something went wrong. Please try again."));
    } finally {
      setLoading(false);
    }
  }

  const field: React.CSSProperties = { width: "100%", padding: "12px 15px", border: "1px solid var(--border-strong)", borderRadius: 9, fontSize: "0.95rem", outline: "none", background: "#fff", color: "#000", boxSizing: "border-box" };
  const labelStyle: React.CSSProperties = { fontSize: "0.72rem", fontWeight: 700, color: "var(--ink)", letterSpacing: "0.08em", textTransform: "uppercase", display: "block", marginBottom: 7 };

  return (
    <main style={{ minHeight: "82vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 24px" }}>
      <div style={{ width: "100%", maxWidth: 440 }}>
        <LangToggle align="center" marginBottom={16} />

        {/* Card */}
        <div style={{ background: "var(--bg-card)", border: "8px solid #fff", borderRadius: 18, padding: "30px 30px 34px", boxShadow: "0 18px 50px rgba(0,0,0,0.35)" }}>
          {/* Fun welcome GIF */}
          <div style={{ display: "flex", justifyContent: "center", marginBottom: 20 }}>
            {/* SmartImage keeps .gif as a plain <img> so it stays animated */}
            <SmartImage src="/images/aegyo-signup.gif" alt="" width={168} height={168} sizes="168px" style={{ objectFit: "cover", borderRadius: 18, border: "1px solid var(--border)", boxShadow: "0 8px 30px rgba(255,111,168,0.25)" }} />
          </div>

          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h1 style={{ fontFamily: "var(--serif)", fontSize: "2rem", fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>
              <T en="Join the fandom" es="Únete al fandom" />
            </h1>
            <p style={{ color: "var(--ink-dim)", fontSize: "0.92rem", margin: 0 }}>
              <T en="Save artists, comment on songs, suggest edits" es="Guarda artistas, comenta canciones, sugiere ediciones" />
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            {error && (
              <div style={{ background: "rgba(255,90,90,0.1)", border: "1px solid rgba(255,90,90,0.35)", borderRadius: 9, padding: "10px 14px", fontSize: "0.85rem", color: "#ff9a9a" }}>
                <T en={error.en} es={error.es} />
              </div>
            )}

            <div>
              <label style={labelStyle}><T en="Display Name" es="Nombre visible" /></label>
              <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={t("Your fan name", "Tu nombre de fan")} style={field} />
            </div>

            <div>
              <label style={labelStyle}><T en="Email" es="Correo" /></label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={t("you@example.com", "tu@ejemplo.com")} style={field} />
            </div>

            <div>
              <label style={labelStyle}><T en="Password" es="Contraseña" /></label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder={t("Min. 6 characters", "Mín. 6 caracteres")} style={field} />
            </div>

            <label style={{ display: "flex", alignItems: "flex-start", gap: 10, cursor: "pointer", fontSize: "0.86rem", color: "var(--ink-dim)", lineHeight: 1.4 }}>
              <input
                type="checkbox"
                checked={subscribe}
                onChange={(e) => setSubscribe(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--sakura)", marginTop: 1, flexShrink: 0, cursor: "pointer" }}
              />
              <span><T en="Email me K-pop rumors, gossip & comebacks 💌" es="Envíame chismes, rumores y comebacks de K-pop 💌" /></span>
            </label>

            <button type="submit" disabled={loading} className="btn-yellow" style={{ width: "100%", padding: "13px", fontSize: "0.85rem", marginTop: 4, opacity: loading ? 0.6 : 1 }}>
              {loading ? <T en="Creating account…" es="Creando cuenta…" /> : <T en="CREATE ACCOUNT" es="CREAR CUENTA" />}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 22, fontSize: "0.88rem", color: "var(--ink-dim)" }}>
          <T en="Already a member?" es="¿Ya tienes cuenta?" />{" "}
          <Link href="/login" style={{ color: "var(--sakura)", fontWeight: 700, textDecoration: "none" }}>
            <T en="Sign in" es="Inicia sesión" />
          </Link>
        </div>

        <div style={{ marginTop: 18, fontSize: "0.72rem", color: "var(--ink-faint)", textAlign: "center", lineHeight: 1.6 }}>
          <T en="By creating an account you agree this is a fan-made site." es="Al crear una cuenta aceptas que este es un sitio hecho por fans." /><br />
          <T en="No personal data is sold or shared." es="No vendemos ni compartimos datos personales." />
        </div>
      </div>
    </main>
  );
}
