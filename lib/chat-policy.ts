import crypto from "node:crypto";

export type ChatValidation = { ok: true; body: string; bodyHash: string } | { ok: false; error: string };

export function hasAegyoAccountSession(session: unknown): boolean {
  if (!session || typeof session !== "object") return false;
  const value = session as { providerSessionId?: unknown; user?: { email?: unknown } };
  return typeof value.providerSessionId === "string" && value.providerSessionId.length > 0 &&
    typeof value.user?.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.user.email);
}

export function chatDisplayName(input: string | null | undefined, userId?: string): string {
  const name = (input ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  if (/^[\p{L}\p{N} _.-]{2,32}$/u.test(name)) return name;
  return userId ? `Fan-${crypto.createHash("sha256").update(userId).digest("hex").slice(0, 6)}` : "Fan";
}

export function validateChatBody(input: unknown): ChatValidation {
  if (typeof input !== "string") return { ok: false, error: "Write a message first." };
  const body = input.normalize("NFKC").replace(/\r\n?/g, "\n").replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, " ").replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
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

type ModerationResult = {
  flagged?: unknown;
  categories?: Record<string, unknown>;
};

export function decideModeration(_body: string, result: ModerationResult): "visible" | "held" {
  const categories = result.categories;
  if (!categories || Object.keys(categories).length === 0 ||
      Object.values(categories).some((active) => typeof active !== "boolean")) throw new Error("moderation_unavailable");
  if (result.flagged === false) return Object.values(categories).some((active) => active === true) ? "held" : "visible";
  if (result.flagged !== true) throw new Error("moderation_unavailable");
  // A flagged message stays private even when a score is near the threshold.
  // Moderators can approve fandom slang without risking an automatic publish.
  return "held";
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
  const data = await response.json() as { results?: ModerationResult[] };
  const result = data.results?.[0];
  if (!result) throw new Error("moderation_unavailable");
  return decideModeration(body, result);
}

export function sameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const configured = process.env.AEGYO_APP_ORIGIN;
  if (!configured) return false;
  try {
    const expected = new URL(configured);
    const postedFrom = new URL(origin);
    const allowedHosts = new Set([expected.host]);
    if (expected.hostname === "aegyoarena.com" || expected.hostname === "www.aegyoarena.com") {
      allowedHosts.add("aegyoarena.com");
      allowedHosts.add("www.aegyoarena.com");
    }
    if (postedFrom.protocol !== expected.protocol || !allowedHosts.has(postedFrom.host)) return false;
    const observed = new URL(request.url);
    const directHost = request.headers.get("host") ?? observed.host;
    const forwardedHost = request.headers.get("x-forwarded-host");
    return directHost === postedFrom.host || (forwardedHost === postedFrom.host &&
      request.headers.get("x-forwarded-proto") === postedFrom.protocol.slice(0, -1));
  } catch { return false; }
}
