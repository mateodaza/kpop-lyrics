"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
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

export default function FanChatbox({ canPost, signedIn }: { canPost: boolean; signedIn: boolean }) {
  const t = useT();
  const { lang } = useLang();
  const [open, setOpen] = useState(false);
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
  const listRef = useRef<HTMLDivElement>(null);

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
    try { setSeenAt(localStorage.getItem(seenKey) || ""); } catch { /* storage optional */ }
    void refresh();
    const interval = window.setInterval(() => { if (!document.hidden) void refresh(); }, 15000);
    return () => window.clearInterval(interval);
  }, [refresh]);

  useEffect(() => {
    if (!open || !messages.length) return;
    const newest = messages[messages.length - 1].createdAt;
    setSeenAt(newest);
    try { localStorage.setItem(seenKey, newest); } catch { /* storage optional */ }
    const list = listRef.current;
    if (list && (list.scrollHeight - list.scrollTop - list.clientHeight < 120 || list.scrollTop === 0)) list.scrollTop = list.scrollHeight;
  }, [open, messages]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const unread = seenAt ? messages.filter((message) => message.createdAt > seenAt).length : 0;
  const latest = messages[messages.length - 1];

  async function send(event: FormEvent) {
    event.preventDefault();
    if (!body.trim() || sending) return;
    setSending(true); setNotice(""); setError("");
    try {
      const response = await fetch("/api/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ body }) });
      const data = await response.json() as { error?: string; status?: string };
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

  return <aside className={`${styles.shell} ${open ? styles.open : styles.closed}`} aria-label={t("Aegyo fan chat", "Chat de fans de Aegyo")}>
    <button type="button" className={styles.toggle} aria-expanded={open} aria-controls="aegyo-chat-room" onClick={() => setOpen((value) => !value)}>
      <svg className={styles.brandMark} viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><path d="M12 2v20M2 12h20M5 5l14 14M19 5 5 19" /></svg>
      <span className={styles.toggleText}><strong>{t("Fan room", "Sala de fans")}</strong><span>{!open && latest ? `${latest.authorName}: ${latest.body}` : t("Aegyo Arena chat", "Chat de Aegyo Arena")}</span></span>
      <span className={styles.count}>{unread > 0 ? `${Math.min(unread, 99)} ${t("new", "nuevos")}` : `${messages.length} ${t("recent", "recientes")}`}</span>
      <svg className={styles.chevron} viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path d="m6 15 6-6 6 6" /></svg>
    </button>
    <div id="aegyo-chat-room" className={styles.room} hidden={!open}>
      <div className={styles.roomHead}><span>{t("Aegyo Arena fan chat", "Chat de fans de Aegyo Arena")}</span><span>{t("Read live · be kind", "Lee en vivo · sé amable")}</span></div>
      <div className={styles.list} ref={listRef} role="log" aria-live="polite" aria-relevant="additions text">
        {loading && <p className={styles.state}>{t("Loading messages…", "Cargando mensajes…")}</p>}
        {!loading && messages.length === 0 && <p className={styles.state}>{t("No messages yet. Start the conversation.", "Aún no hay mensajes. Inicia la conversación.")}</p>}
        {messages.map((message) => <div key={message.id} className={styles.message}>
          <div className={styles.messageLine}><strong className={styles.author}>{message.authorName}</strong><span className={styles.messageBody}>{message.body}</span><time dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}</time>
            {canPost && !reported.includes(message.id) && <button className={styles.reportButton} type="button" aria-label={`${t("Report message from", "Reportar mensaje de")} ${message.authorName}`} onClick={() => setReporting(reporting === message.id ? null : message.id)}><svg viewBox="0 0 20 20" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path d="M4 17V3m0 1h11l-2 4 2 4H4" /></svg></button>}
          </div>
          {reporting === message.id && <div className={styles.reportForm}><label htmlFor="chat-report-reason">{t("Reason", "Motivo")}</label><select id="chat-report-reason" value={reason} onChange={(event) => setReason(event.target.value)}>{reportReasons.map(([value, en, es]) => <option key={value} value={value}>{t(en, es)}</option>)}</select><button type="button" onClick={() => void report(message.id)}>{t("Send report", "Enviar reporte")}</button></div>}
        </div>)}
      </div>
      <div className={styles.compose}>
        {(error || notice) && <p className={error ? styles.error : styles.notice} role={error ? "alert" : "status"}>{error || notice}</p>}
        {canPost ? <form onSubmit={send}><label className={styles.srOnly} htmlFor="aegyo-chat-message">{t("Your message", "Tu mensaje")}</label><input id="aegyo-chat-message" value={body} maxLength={500} onChange={(event) => setBody(event.target.value)} placeholder={t("Chat with other fans…", "Habla con otros fans…")} /><button type="submit" disabled={sending || body.trim().length < 2}>{sending ? t("Sending…", "Enviando…") : t("Send", "Enviar")}</button></form> : signedIn ? <p>{t("Sign in with Aegyo Accounts to post here.", "Inicia sesión con Aegyo Accounts para publicar aquí.")}</p> : <p>{t("Sign in with your Aegyo account to join the chat.", "Inicia sesión con tu cuenta Aegyo para participar.")} <Link href="/login">{t("Sign in", "Iniciar sesión")}</Link></p>}
        <small>{t("Public chat · no links or personal details", "Chat público · sin enlaces ni datos personales")} · <Link href="/privacy-policy">{t("Privacy", "Privacidad")}</Link></small>
      </div>
    </div>
  </aside>;
}
