"use client";

import { useState } from "react";

type Item = { id: string; body: string; author: string; status: string; reason: string | null; createdAt: string; reports: string[] };

export default function ChatReview({ initialItems }: { initialItems: Item[] }) {
  const [items, setItems] = useState(initialItems);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  async function review(id: string, decision: "visible" | "removed") {
    setBusy(id); setError("");
    try {
      const response = await fetch("/api/admin/chat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, decision }) });
      if (!response.ok) throw new Error("Could not save review. Try again.");
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save review."); }
    finally { setBusy(null); }
  }
  return <div className="chat-review-list" aria-live="polite">
    {error && <p role="alert">{error}</p>}
    {items.length === 0 && <p>No chat messages need review.</p>}
    {items.map((item) => <article key={item.id} className="chat-review-item">
      <div className="chat-review-meta"><strong>{item.author}</strong><span>{new Date(item.createdAt).toLocaleString()}</span><span>{item.status}</span></div>
      <p>{item.body}</p>
      <small>{item.reason || "Reported"}{item.reports.length ? ` · ${item.reports.join(", ")}` : ""}</small>
      <div className="chat-review-actions"><button type="button" disabled={busy === item.id} onClick={() => review(item.id, "visible")}>Approve</button><button type="button" disabled={busy === item.id} onClick={() => review(item.id, "removed")}>Remove</button></div>
    </article>)}
  </div>;
}
