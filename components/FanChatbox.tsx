"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLang, useT } from "@/components/LangProvider";
import styles from "./FanChatbox.module.css";

type Message = { id: string; body: string; authorName: string; createdAt: string };
const seenKey = "aegyo-chat-last-seen";
const reportReasons = [
  ["abuse", "Abuse or hate", "Abuso u odio"],
  ["sexual", "Sexual content", "Contenido sexual"],
  ["spam", "Spam", "Spam"],
  ["personal_info", "Personal information", "Información personal"],
  ["other", "Other", "Otro"],
] as const;

export default function FanChatbox({ canPost, signedIn, fullPage = false }: { canPost: boolean; signedIn: boolean; fullPage?: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const pathname = usePathname();
  const dockHidden = !fullPage && pathname === "/chat";
  const [open, setOpen] = useState(fullPage);
  const [messages, setMessages] = useState<Message[]>([]);
  const [seenAt, setSeenAt] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [reporting, setReporting] = useState<string | null>(null);
  const [reason, setReason] = useState("abuse");
  const [reported, setReported] = useState<string[]>([]);
  const [participation, setParticipation] = useState<"loading" | "required" | "accepted">(canPost ? "loading" : "required");
  const [acceptRules, setAcceptRules] = useState(false);
  const [confirmAge16, setConfirmAge16] = useState(false);
  const [savingAgreement, setSavingAgreement] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!canPost || dockHidden) return;
    let active = true;
    fetch("/api/chat/participation", { cache: "no-store" })
      .then(async (response) => { if (!response.ok) throw new Error(); return response.json() as Promise<{ accepted?: boolean }>; })
      .then((data) => { if (active) setParticipation(data.accepted ? "accepted" : "required"); })
      .catch(() => { if (active) { setParticipation("required"); setError(lang === "es" ? "No pudimos comprobar tu acceso al chat. Inténtalo de nuevo." : "Could not check chat access. Please try again."); } });
    return () => { active = false; };
  }, [canPost, dockHidden, lang]);

  useEffect(() => {
    const field = composerRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 136)}px`;
  }, [body, participation]);

  const refresh = useCallback(async () => {
    try {
      const response = await fetch("/api/chat", { cache: "no-store" });
      if (!response.ok) throw new Error();
      const data = await response.json() as { messages?: Message[] };
      if (!Array.isArray(data.messages)) throw new Error();
      setMessages(data.messages);
      setError("");
    } catch { setError(lang === "es" ? "No se pudo cargar el chat. Reintentaremos pronto." : "Could not load chat. Retrying shortly."); }
    finally { setLoading(false); }
  }, [lang]);

  useEffect(() => {
    if (dockHidden) return;
    try { setSeenAt(localStorage.getItem(seenKey) || ""); } catch { /* storage optional */ }
    void refresh();
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    return () => window.clearInterval(interval);
  }, [refresh, dockHidden]);

  useEffect(() => {
    if (!open || !messages.length) return;
    const newest = messages[messages.length - 1].createdAt;
    setSeenAt(newest);
    try { localStorage.setItem(seenKey, newest); } catch { /* storage optional */ }
    const list = listRef.current;
    if (list && (list.scrollHeight - list.scrollTop - list.clientHeight < 120 || list.scrollTop === 0)) list.scrollTop = list.scrollHeight;
  }, [open, messages]);

  useEffect(() => {
    if (!open || fullPage) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, fullPage]);

  if (dockHidden) return null;

  const unread = seenAt ? messages.filter((message) => message.createdAt > seenAt).length : 0;
  const latest = messages[messages.length - 1];
  const length = [...body].length;

  async function acceptParticipation(event: FormEvent) {
    event.preventDefault();
    if (!acceptRules || !confirmAge16 || savingAgreement) return;
    setSavingAgreement(true); setError("");
    try {
      const response = await fetch("/api/chat/participation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ acceptRules: true, confirmAge16: true }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not save agreement.");
      setParticipation("accepted");
      setNotice(t("You’re in. Welcome to the fan room!", "Ya puedes participar. ¡Bienvenido a la sala de fans!"));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save agreement."); }
    finally { setSavingAgreement(false); }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || sending || length > 500 || participation !== "accepted") return;
    setSending(true); setNotice(""); setError("");
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const data = await response.json() as { error?: string; status?: string; code?: string };
      if (data.code === "chat_agreement_required") setParticipation("required");
      if (!response.ok) throw new Error(data.error || "Could not send message.");
      setBody("");
      setNotice(data.status === "held" ? t("Your message is waiting for review.", "Tu mensaje está pendiente de revisión.") : "");
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send message."); }
    finally { setSending(false); }
  }

  async function report(messageId: string) {
    setError("");
    try {
      const response = await fetch("/api/chat/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ messageId, reason }) });
      const data = await response.json() as { error?: string };
      if (!response.ok) throw new Error(data.error || "Could not send report.");
      setReported((current) => [...current, messageId]);
      setReporting(null);
      setNotice(t("Report sent. Thank you.", "Reporte enviado. Gracias."));
      await refresh();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not send report."); }
  }

  return <aside className={`${styles.shell} ${open ? styles.open : styles.closed} ${fullPage ? styles.fullPage : ""}`} aria-label={t("Aegyo fan chat", "Chat de fans de Aegyo")}>
    {fullPage ? <div className={styles.fullHeader}><span className={styles.fullHeaderTitle}><svg className={styles.brandMark} viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19" /></svg><strong><span className={styles.liveDot} />{t("Aegyo fan room", "Sala de fans de Aegyo")}</strong></span><Link href="/">{t("Back to Aegyo", "Volver a Aegyo")}</Link></div> : <button type="button" className={styles.toggle} aria-expanded={open} aria-controls="aegyo-chat-room" onClick={() => setOpen((value) => !value)}>
      <svg className={styles.brandMark} viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19" /></svg>
      <span className={styles.toggleText}><strong>{t("Fan room", "Sala de fans")}</strong><span>{!open && latest ? `${latest.authorName}: ${latest.body}` : t("Aegyo Arena chat", "Chat de Aegyo Arena")}</span></span>
      <span className={styles.count}>{unread > 0 ? `${Math.min(unread, 99)} ${t("new", "nuevos")}` : `${messages.length} ${t("recent", "recientes")}`}</span>
      <svg className={styles.chevron} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
    </button>}
    <div id="aegyo-chat-room" className={styles.room} hidden={!open}>
      <div className={styles.roomHead}><span>#all-fans</span><span>{t("Read live · be kind", "Lee en vivo · sé amable")}</span></div>
      <div className={styles.list} ref={listRef} role="log" aria-live="polite" aria-relevant="additions text">
        {loading && <p className={styles.state}>{t("Loading messages…", "Cargando mensajes…")}</p>}
        {!loading && messages.length === 0 && <div className={styles.emptyState}><svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden="true"><path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19" /></svg><strong>{t("The room is yours.", "La sala es tuya.")}</strong><p>{t("What K-pop moment is on repeat for you today?", "¿Qué momento K-pop tienes en repeat hoy?")}</p></div>}
        {messages.map((message) => <div key={message.id} className={styles.message}>
          <div className={styles.messageLine}><strong className={styles.author}>{message.authorName}</strong><span className={styles.messageBody}>{message.body}</span><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</time>
            {canPost && !reported.includes(message.id) && <button className={styles.reportButton} type="button" aria-label={`${t("Report message from", "Reportar mensaje de")} ${message.authorName}`} onClick={() => setReporting(reporting === message.id ? null : message.id)}><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 17V3m0 1h11l-2 4 2 4H4" /></svg></button>}
          </div>
          {reporting === message.id && <div className={styles.reportForm}><label htmlFor="chat-report-reason">{t("Reason", "Motivo")}</label><select id="chat-report-reason" value={reason} onChange={(event) => setReason(event.target.value)}>{reportReasons.map(([value, en, es]) => <option key={value} value={value}>{t(en, es)}</option>)}</select><button type="button" onClick={() => void report(message.id)}>{t("Send report", "Enviar reporte")}</button></div>}
        </div>)}
      </div>
      <div className={styles.compose}>
        {(error || notice) && <p className={error ? styles.error : styles.notice} role={error ? "alert" : "status"}>{error || notice}</p>}
        {canPost && participation === "loading" && <p>{t("Checking your chat access…", "Comprobando tu acceso al chat…")}</p>}
        {canPost && participation === "required" && <form className={styles.agreement} onSubmit={acceptParticipation}>
          <strong>{t("Before you join in", "Antes de participar")}</strong>
          <p>{t("One quick check keeps this room welcoming for everyone.", "Una breve confirmación ayuda a que esta sala sea agradable para todos.")}</p>
          <div className={styles.agreementChoice}><input id={fullPage ? "chat-age-full" : "chat-age-dock"} type="checkbox" checked={confirmAge16} onChange={(event) => setConfirmAge16(event.target.checked)} /><label htmlFor={fullPage ? "chat-age-full" : "chat-age-dock"}>{t("I confirm I’m at least 16 years old.", "Confirmo que tengo al menos 16 años.")}</label></div>
          <div className={styles.agreementChoice}><input id={fullPage ? "chat-rules-full" : "chat-rules-dock"} type="checkbox" checked={acceptRules} onChange={(event) => setAcceptRules(event.target.checked)} /><label htmlFor={fullPage ? "chat-rules-full" : "chat-rules-dock"}>{t("I agree to the", "Acepto las")}</label> <Link href="/chat/rules" target="_blank" rel="noopener noreferrer">{t("Fan Chat Terms", "Reglas del chat")}</Link> <span>{t("and", "y la")}</span> <Link href="/privacy-policy" target="_blank" rel="noopener noreferrer">{t("Privacy Policy", "Política de Privacidad")}</Link>.</div>
          <button type="submit" disabled={!acceptRules || !confirmAge16 || savingAgreement}>{savingAgreement ? t("Saving…", "Guardando…") : t("Join the conversation", "Entrar en la conversación")}</button>
        </form>}
        {canPost && participation === "accepted" && <form className={styles.composerForm} onSubmit={send}>
          <label className={styles.srOnly} htmlFor={fullPage ? "aegyo-chat-message-full" : "aegyo-chat-message"}>{t("Your message", "Tu mensaje")}</label>
          <div className={styles.composerRow}><textarea ref={composerRef} id={fullPage ? "aegyo-chat-message-full" : "aegyo-chat-message"} rows={1} value={body} onChange={(event) => setBody([...event.target.value].slice(0, 500).join(""))} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} placeholder={t("Drop your take…", "Comparte lo que piensas…")} aria-describedby={fullPage ? "chat-limit-full" : "chat-limit-dock"} /><button type="submit" disabled={sending || [...body.trim()].length < 2 || length > 500}>{sending ? t("Sending…", "Enviando…") : t("Send", "Enviar")}</button></div>
          <div className={styles.composerMeta}><span>{t("Enter to send · Shift+Enter for a new line", "Enter para enviar · Shift+Enter para otra línea")}</span><span id={fullPage ? "chat-limit-full" : "chat-limit-dock"} className={length >= 500 ? styles.limitReached : ""} role={length >= 500 ? "status" : undefined}>{length >= 500 ? t("Limit reached · 500/500", "Límite alcanzado · 500/500") : `${length}/500`}</span></div>
        </form>}
        {!canPost && <p>{signedIn ? t("Use your shared Aegyo account to post here.", "Usa tu cuenta Aegyo compartida para publicar aquí.") : t("Sign in with your Aegyo account to join the chat.", "Inicia sesión con tu cuenta Aegyo para participar.")} <Link href="/login">{t("Sign in", "Iniciar sesión")}</Link></p>}
        <small>{t("Public chat · no links or personal details", "Chat público · sin enlaces ni datos personales")} · <Link href="/chat/rules">{t("Rules", "Reglas")}</Link></small>
        {!fullPage && <Link className={styles.fullRoomLink} href="/chat">{t("Open the full fan room", "Abrir la sala completa")} <span aria-hidden="true">↗</span></Link>}
      </div>
    </div>
  </aside>;
}
