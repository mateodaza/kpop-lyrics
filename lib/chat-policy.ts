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
  category_scores?: Record<string, unknown>;
};

export function decideModeration(body: string, result: ModerationResult): "visible" | "held" {
  if (result.flagged === false) return Object.values(result.categories ?? {}).some((active) => active === true) ? "held" : "visible";
  if (result.flagged !== true) throw new Error("moderation_unavailable");
  const categories = result.categories;
  const scores = result.category_scores;
  if (categories && scores && categories.harassment === true &&
      Object.entries(categories).every(([name, active]) => name === "harassment" || active !== true) &&
      typeof scores.harassment === "number" && scores.harassment < 0.85 &&
      !/(?:^|\s)(?:you|your|u|ur)\b|@[\w.]+/i.test(body)) return "visible";
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
    const observed = new URL(request.url);
    const direct = request.headers.get("host") === expected.host || observed.host === expected.host;
    const forwarded = request.headers.get("x-forwarded-host") === expected.host &&
      request.headers.get("x-forwarded-proto") === expected.protocol.slice(0, -1);
    return new URL(origin).origin === expected.origin && (direct || forwarded);
  } catch { return false; }
}
