"use client";

import { useState } from "react";
import Link from "next/link";
import { T, LangToggle, useT } from "@/components/LangProvider";

const labelStyle: React.CSSProperties = { fontSize: "0.78rem", fontWeight: 700, color: "#fff", letterSpacing: "0.06em", textTransform: "uppercase", display: "block", marginBottom: 6 };
const inputStyle: React.CSSProperties = { width: "100%", padding: "10px 14px", border: "1px solid var(--genius-border)", borderRadius: 4, fontSize: "0.95rem", outline: "none", background: "#fff", color: "#000", boxSizing: "border-box" };

/**
 * The forgot/reset APIs answer in English, so keep both languages on the error
 * and let <T> pick at render time — that way the message follows the toggle even
 * after it is on screen. Covers the strings app/api/auth/{forgot,reset}/route.ts
 * can return plus our local ones; anything unrecognised falls through in English.
 */
const ES_ERRORS: Record<string, string> = {
  "Something went wrong.": "Algo salió mal.",
  "Something went wrong. Please try again.": "Algo salió mal. Inténtalo de nuevo.",
  "Passwords don't match.": "Las contraseñas no coinciden.",
  "Please enter a valid email address.": "Ingresa un correo electrónico válido.",
  "Enter the 6-digit code and a new password (at least 6 characters).": "Ingresa el código de 6 dígitos y una nueva contraseña (al menos 6 caracteres).",
  "That code is invalid or has expired. Please request a new one.": "Ese código no es válido o ya expiró. Solicita uno nuevo.",
};
const err = (en: string) => ({ en, es: ES_ERRORS[en] ?? en });

export default function ForgotPasswordPage() {
  const t = useT();
  const [step, setStep] = useState<"request" | "reset" | "done">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<{ en: string; es: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function requestCode(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email }) });
      const d = await res.json();
      if (res.status === 409 && typeof d.redirect === "string") {
        window.location.assign(d.redirect);
        return;
      }
      if (!res.ok) { setError(err(d.error ?? "Something went wrong.")); return; }
      setStep("reset");
    } catch { setError(err("Something went wrong. Please try again.")); }
    finally { setLoading(false); }
  }

  async function reset(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) { setError(err("Passwords don't match.")); return; }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, code, newPassword: password }) });
      const d = await res.json();
      if (res.status === 409 && typeof d.redirect === "string") {
        window.location.assign(d.redirect);
        return;
      }
      if (!res.ok) { setError(err(d.error ?? "Something went wrong.")); return; }
      setStep("done");
    } catch { setError(err("Something went wrong. Please try again.")); }
    finally { setLoading(false); }
  }

  return (
    <main style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <LangToggle align="center" marginBottom={16} />

        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <Link href="/" style={{ fontFamily: "monospace", fontSize: "1.5rem", fontWeight: 800, color: "var(--genius-yellow)", textDecoration: "none", background: "#000", padding: "4px 14px", borderRadius: 4 }}>
            Aegyo Arena
          </Link>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 800, marginTop: 20, marginBottom: 6, color: "#fff" }}>
            <T en="Reset your password" es="Restablece tu contraseña" />
          </h1>
          <p style={{ color: "var(--genius-gray)", fontSize: "0.88rem" }}>
            {step === "request" && <T en="Enter your email and we'll send you a 6-digit reset code." es="Ingresa tu correo y te enviaremos un código de 6 dígitos." />}
            {step === "reset" && <T en="Enter the code we emailed you and choose a new password." es="Ingresa el código que te enviamos y elige una nueva contraseña." />}
            {step === "done" && <T en="All set." es="¡Listo!" />}
          </p>
        </div>

        {error && (
          <div style={{ background: "#fff0f0", border: "1px solid #ffcdd2", borderRadius: 4, padding: "10px 14px", fontSize: "0.85rem", color: "#c62828", marginBottom: 14 }}>
            <T en={error.en} es={error.es} />
          </div>
        )}

        {step === "request" && (
          <form onSubmit={requestCode} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={labelStyle}><T en="Email" es="Correo" /></label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder={t("you@example.com", "tu@ejemplo.com")} style={inputStyle} />
            </div>
            <button type="submit" disabled={loading} className="btn-yellow" style={{ width: "100%", padding: "12px", fontSize: "0.85rem", marginTop: 6, opacity: loading ? 0.6 : 1 }}>
              {loading ? <T en="Sending…" es="Enviando…" /> : <T en="SEND RESET CODE" es="ENVIAR CÓDIGO" />}
            </button>
          </form>
        )}

        {step === "reset" && (
          <form onSubmit={reset} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid var(--genius-border)", borderRadius: 4, padding: "10px 14px", fontSize: "0.82rem", color: "var(--genius-gray)" }}>
              <T en="If an account exists for " es="Si existe una cuenta para " />
              <strong style={{ color: "#fff" }}>{email}</strong>
              <T en=", a 6-digit code is on its way. It expires in 15 minutes." es=", el código de 6 dígitos va en camino. Expira en 15 minutos." />
            </div>
            <div>
              <label style={labelStyle}><T en="Reset code" es="Código de recuperación" /></label>
              <input inputMode="numeric" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} required placeholder="123456" style={{ ...inputStyle, letterSpacing: "0.4em", fontWeight: 700 }} />
            </div>
            <div>
              <label style={labelStyle}><T en="New password" es="Nueva contraseña" /></label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} placeholder={t("Min. 6 characters", "Mín. 6 caracteres")} style={inputStyle} />
            </div>
            <div>
              <label style={labelStyle}><T en="Confirm new password" es="Confirma la nueva contraseña" /></label>
              <input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} required minLength={6} placeholder={t("Re-enter password", "Vuelve a escribir la contraseña")} style={inputStyle} />
            </div>
            <button type="submit" disabled={loading} className="btn-yellow" style={{ width: "100%", padding: "12px", fontSize: "0.85rem", marginTop: 6, opacity: loading ? 0.6 : 1 }}>
              {loading ? <T en="Resetting…" es="Restableciendo…" /> : <T en="RESET PASSWORD" es="RESTABLECER CONTRASEÑA" />}
            </button>
            <button type="button" onClick={() => { setStep("request"); setError(null); }} style={{ background: "none", border: "none", color: "var(--genius-gray)", fontSize: "0.8rem", cursor: "pointer" }}>
              <T en="← Use a different email" es="← Usar otro correo" />
            </button>
          </form>
        )}

        {step === "done" && (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.4rem", marginBottom: 10 }}>✅</div>
            <p style={{ color: "#fff", fontSize: "1rem", fontWeight: 700, marginBottom: 6 }}>
              <T en="Password updated" es="Contraseña actualizada" />
            </p>
            <p style={{ color: "var(--genius-gray)", fontSize: "0.88rem", marginBottom: 22 }}>
              <T en="You can now sign in with your new password." es="Ya puedes iniciar sesión con tu nueva contraseña." />
            </p>
            <Link href="/login" className="btn-yellow" style={{ display: "inline-block", padding: "12px 28px", fontSize: "0.85rem", textDecoration: "none" }}>
              <T en="GO TO SIGN IN" es="IR A INICIAR SESIÓN" />
            </Link>
          </div>
        )}

        <div style={{ textAlign: "center", marginTop: 24, fontSize: "0.85rem", color: "var(--genius-gray)" }}>
          <T en="Remembered it?" es="¿Ya la recordaste?" />{" "}
          <Link href="/login" style={{ color: "var(--sakura)", fontWeight: 700, textDecoration: "none" }}>
            <T en="Back to sign in" es="Volver a iniciar sesión" />
          </Link>
        </div>
      </div>
    </main>
  );
}
