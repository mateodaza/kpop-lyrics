"use client";

import { useState } from "react";

type Item = { id: string; body: string; author: string; authorId: string; status: string; reason: string | null; createdAt: string; reports: string[] };
type RecentItem = Pick<Item, "id" | "body" | "author" | "authorId" | "createdAt">;
type Mute = { userId: string; name: string; until: string; reason: string };

export default function ChatReview({ initialItems, initialRecent, initialMutes }: { initialItems: Item[]; initialRecent: RecentItem[]; initialMutes: Mute[] }) {
  const [items, setItems] = useState(initialItems);
  const [recent, setRecent] = useState(initialRecent);
  const [mutes, setMutes] = useState(initialMutes);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function review(id: string, decision: "visible" | "removed") {
    setBusy(id); setError("");
    try {
      const response = await fetch("/api/admin/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
      if (!response.ok) throw new Error("Could not save review. Try again.");
      setItems((current) => current.filter((item) => item.id !== id));
      if (decision === "removed") setRecent((current) => current.filter((item) => item.id !== id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save review."); }
    finally { setBusy(null); }
  }
  async function mute(userId: string) {
    const reason = window.prompt("Reason for a 24-hour chat mute");
    if (!reason?.trim()) return;
    setBusy(userId); setError("");
    try {
      const response = await fetch("/api/admin/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, decision: "mute", reason }) });
      if (!response.ok) throw new Error("Could not mute this user.");
      setItems((current) => current.filter((item) => item.authorId !== userId));
      setMutes((current) => [...current.filter((item) => item.userId !== userId), { userId, name: items.find((item) => item.authorId === userId)?.author ?? recent.find((item) => item.authorId === userId)?.author ?? "Fan", until: new Date(Date.now() + 86400000).toISOString(), reason }]);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not mute this user."); }
    finally { setBusy(null); }
  }
  async function unmute(userId: string) {
    setBusy(userId); setError("");
    try {
      const response = await fetch("/api/admin/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, decision: "unmute" }) });
      if (!response.ok) throw new Error("Could not remove this mute.");
      setMutes((current) => current.filter((item) => item.userId !== userId));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not remove this mute."); }
    finally { setBusy(null); }
  }
  return <div className="chat-review-list" aria-live="polite">
    {error && <p role="alert">{error}</p>}
    {items.length === 0 && <p>No chat messages need review.</p>}
    {items.map((item) => <article key={item.id} className="chat-review-item">
      <div className="chat-review-meta"><strong>{item.author}</strong><span>{new Date(item.createdAt).toLocaleString()}</span><span>{item.status}</span></div>
      <p>{item.body}</p>
      <small>{item.reason || "Reported"}{item.reports.length ? ` · ${item.reports.join(", ")}` : ""}</small>
      <div className="chat-review-actions"><button type="button" disabled={busy !== null} onClick={() => review(item.id, "visible")}>Approve</button><button type="button" disabled={busy !== null} onClick={() => review(item.id, "removed")}>Remove</button><button type="button" disabled={busy !== null} onClick={() => mute(item.authorId)}>Mute 24h</button></div>
    </article>)}
    <h2>Recent visible messages</h2>
    {recent.length === 0 && <p>No visible chat messages yet.</p>}
    {recent.map((item) => <article key={item.id} className="chat-review-item">
      <div className="chat-review-meta"><strong>{item.author}</strong><span>{new Date(item.createdAt).toLocaleString()}</span></div>
      <p>{item.body}</p>
      <div className="chat-review-actions"><button type="button" disabled={busy !== null} onClick={() => review(item.id, "removed")}>Remove</button><button type="button" disabled={busy !== null} onClick={() => mute(item.authorId)}>Mute 24h</button></div>
    </article>)}
    <h2>Active chat mutes</h2>
    {mutes.length === 0 && <p>No active mutes.</p>}
    {mutes.map((mute) => <article key={mute.userId} className="chat-review-item"><strong>{mute.name}</strong><p>Until {new Date(mute.until).toLocaleString()} · {mute.reason}</p><button type="button" disabled={busy !== null} onClick={() => unmute(mute.userId)}>Unmute</button></article>)}
  </div>;
}
