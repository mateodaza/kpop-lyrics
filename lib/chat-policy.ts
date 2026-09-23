import crypto from "node:crypto";

export type ChatValidation = { ok: true; body: string; bodyHash: string } | { ok: false; error: string };

export function hasAegyoAccountSession(session: unknown): boolean {
  if (!session || typeof session !== "object") return false;
  const value = session as { providerSessionId?: unknown; user?: { email?: unknown } };
  return typeof value.providerSessionId === "string" && value.providerSessionId.length > 0 &&
    typeof value.user?.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.user.email);
}

export function chatDisplayName(input: string | null | undefined): string {
  const name = (input ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  return /^[\p{L}\p{N} _.-]{2,32}$/u.test(name) ? name : "Fan";
}

export function validateChatBody(input: unknown): ChatValidation {
  if (typeof input !== "string") return { ok: false, error: "Write a message first." };
  const body = input.normalize("NFKC").replace(/[\u0000-\u001f\u007f-\u009f]/g, " ").replace(/\s+/g, " ").trim();
  const length = [...body].length;
  if (length < 2 || length > 500) return { ok: false, error: "Messages must be 2–500 characters." };
  if (/https?:\/\/|www\.|\b(?:[a-z0-9-]+\.)+[a-z]{2,24}(?:[/?#:]\S*)?\b/i.test(body)) {
    return { ok: false, error: "Links are not allowed in the chat." };
  }
  if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(body) || /(?:\+?\d[\d\s().-]{8,}\d)/.test(body)) {
    return { ok: false, error: "Please do not share contact details in chat." };
  }
  if (/(.)\1{11,}/u.test(body) || /\b(\S+)(?:\s+\1){5,}\b/iu.test(body)) {
    return { ok: false, error: "Please avoid repeated text." };
  }
  return { ok: true, body, bodyHash: crypto.createHash("sha256").update(body.toLocaleLowerCase()).digest("hex") };
}

export async function classifyChatBody(body: string): Promise<"visible" | "held"> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("moderation_unavailable");
  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "omni-moderation-latest", input: body }),
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("moderation_unavailable");
  const data = await response.json() as { results?: Array<{ flagged?: unknown }> };
  const flagged = data.results?.[0]?.flagged;
  if (typeof flagged !== "boolean") throw new Error("moderation_unavailable");
  return flagged ? "held" : "visible";
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  try { return new URL(origin).origin === new URL(request.url).origin; } catch { return false; }
}
