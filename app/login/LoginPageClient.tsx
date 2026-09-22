"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { trackLoginPageView, trackLoginSuccess } from "@/lib/conversions";
import { T, LangToggle, useT } from "@/components/LangProvider";

/**
 * The login API answers in English, so keep both languages on the error and let
 * <T> pick at render time — that way the message follows the toggle even after
 * it is on screen. Covers the strings app/api/auth/login/route.ts can return
 * plus our local fallbacks; anything unrecognised falls through in English.
 */
const ES_ERRORS: Record<string, string> = {
  "Login failed": "No se pudo iniciar sesión.",
  "Something went wrong. Please try again.": "Algo salió mal. Inténtalo de nuevo.",
  "Email and password required": "Ingresa tu correo y tu contraseña.",
  "Invalid email or password": "Correo o contraseña incorrectos.",
};
const err = (en: string) => ({ en, es: ES_ERRORS[en] ?? en });

export default function LoginPage() {
  const router = useRouter();
  const t = useT();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<{ en: string; es: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Pageview conversion (GA4 / Reddit / TikTok / Taboola).
  useEffect(() => { trackLoginPageView(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.status === 409 && typeof data.redirect === "string") {
        window.location.assign(data.redirect);
        return;
      }
      if (!res.ok) { setError(err(data.error ?? "Login failed")); return; }
      trackLoginSuccess();
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
        <div style={{ background: "var(--bg-card)", border: "8px solid #fff", borderRadius: 18, padding: "34px 30px", boxShadow: "0 18px 50px rgba(0,0,0,0.35)" }}>
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h1 style={{ fontFamily: "var(--serif)", fontSize: "2rem", fontWeight: 700, color: "var(--ink)", margin: "0 0 6px" }}>
              <T en="Welcome back" es="Hola de nuevo" />
            </h1>
            <p style={{ color: "var(--ink-dim)", fontSize: "0.92rem", margin: 0 }}>
              <T en="Sign in to save favorites, comment, and more" es="Inicia sesión para guardar favoritos, comentar y más" />
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 15 }}>
            {error && (
              <div style={{ background: "rgba(255,90,90,0.1)", border: "1px solid rgba(255,90,90,0.35)", borderRadius: 9, padding: "10px 14px", fontSize: "0.85rem", color: "#ff9a9a" }}>
                <T en={error.en} es={error.es} />
              </div>
            )}

            <div>
              <label style={labelStyle}><T en="Email" es="Correo" /></label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={t("you@example.com", "tu@ejemplo.com")} style={field} />
            </div>

            <div>
              <label style={labelStyle}><T en="Password" es="Contraseña" /></label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" style={field} />
            </div>

            <div style={{ textAlign: "right", marginTop: -4 }}>
              <Link href="/api/auth/recovery" style={{ fontSize: "0.8rem", color: "var(--sakura)", fontWeight: 600, textDecoration: "none" }}>
                <T en="Forgot my password?" es="¿Olvidaste tu contraseña?" />
              </Link>
            </div>

            <button type="submit" disabled={loading} className="btn-yellow" style={{ width: "100%", padding: "13px", fontSize: "0.85rem", marginTop: 4, opacity: loading ? 0.6 : 1 }}>
              {loading ? <T en="Signing in…" es="Iniciando sesión…" /> : <T en="SIGN IN" es="INICIAR SESIÓN" />}
            </button>
          </form>
        </div>

        <div style={{ textAlign: "center", marginTop: 22, fontSize: "0.88rem", color: "var(--ink-dim)" }}>
          <T en="No account?" es="¿No tienes cuenta?" />{" "}
          <Link href="/signup" style={{ color: "var(--sakura)", fontWeight: 700, textDecoration: "none" }}>
            <T en="Create one free" es="Crea una gratis" />
          </Link>
        </div>
      </div>
    </main>
  );
}
