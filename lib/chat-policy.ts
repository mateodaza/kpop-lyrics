import crypto from "node:crypto";

export type ChatValidation = { ok: true; body: string; bodyHash: string } | { ok: false; error: string };

export function hasAegyoAccountSession(session: unknown): boolean {
  if (!session || typeof session !== "object") return false;
  const value = session as { providerSessionId?: unknown; user?: { email?: unknown } };
  return typeof value.providerSessionId === "string" && value.providerSessionId.length > 0 &&
    typeof value.user?.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.user.email);
}

export function canWriteChatInEnvironment(email: unknown): boolean {
  const configured = process.env.AEGYO_CHAT_WRITE_ALLOWLIST;
  if (configured === undefined) return true;
  if (typeof email !== "string") return false;
  return configured.split(",").some((allowed) => allowed.trim().toLowerCase() === email.toLowerCase());
}

export function chatDisplayName(input: string | null | undefined, userId?: string): string {
  const name = (input ?? "").normalize("NFKC").replace(/\s+/g, " ").trim();
  const roleScan = name.toLowerCase().normalize("NFKD").replace(/\p{M}/gu, "").replace(/[013457]/g, (digit) => ({ "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t" })[digit] ?? digit);
  const compact = roleScan.replace(/[^a-z]/g, "");
  const roleName = /(?:^|[ _.-])(?:admins?|mods?|moderators?|staff|support|official)(?:$|[ _.-])/u.test(roleScan);
  const brandTeam = /\b(?:aegyo|myosin)\b.*\bteam\b|\bteam\b.*\b(?:aegyo|myosin)\b/u.test(roleScan) || /(?:aegyo|myosin)(?:team|mod|admin|staff|support|official)/u.test(compact);
  if (/^[\p{L}\p{N} _.-]{2,32}$/u.test(name) && !roleName && !brandTeam) {
    return userId ? `${crypto.createHash("sha256").update(userId).digest("hex").slice(0, 6)} · ${[...name].slice(0, 23).join("")}` : name;
  }
  return userId ? `Fan-${crypto.createHash("sha256").update(userId).digest("hex").slice(0, 6)}` : "Fan";
}

export function validateChatBody(input: unknown): ChatValidation {
  if (typeof input !== "string") return { ok: false, error: "Write a message first." };
  const body = input.normalize("NFKC").replace(/\r\n?/g, "\n").replace(/[\u200b-\u200d\u2060\u202a-\u202e\ufeff]/g, "").replace(/[\u0000-\u0009\u000b-\u001f\u007f-\u009f]/g, " ").replace(/[^\S\n]+/g, " ").replace(/ *\n */g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  const length = [...body].length;
  if ((length < 2 && !/^\p{Extended_Pictographic}$/u.test(body)) || length > 500) return { ok: false, error: "Messages must be 2–500 characters, or one emoji." };
  const linkScan = body.replace(/\[\s*\.\s*\]|\(\s*dot\s*\)/giu, ".");
  if (/https?:\/\/|www\.|\b(?:[a-z0-9-]+\.)+(?:com|net|org|gg|io|app|dev|ai|co|me|xyz|tv|ly|info|site|online|club|shop|kr|uk|us|ca|jp|es|fr|de)(?:[/?#:]\S*)?\b/i.test(linkScan)) {
    return { ok: false, error: "Links are not allowed in the chat." };
  }
  if (/[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(body) || /(?:^|[^\d])\+?\d{9,15}(?=$|[^\d])/.test(body) || /(?:^|[^\d])(?:\+?\d{1,3}[\s.-])?(?:\(\d{2,3}\)|\d{2,3})[\s.-]\d{3,4}[\s.-]\d{4}\b/.test(body)) {
    return { ok: false, error: "Please do not share contact details in chat." };
  }
  if (/\b[\w.+-]+\s*(?:at|\(at\))\s*(?:gmail|hotmail|yahoo|outlook|icloud|proton|[\w-]+)\s*(?:dot|\(dot\))\s*(?:com|net|org)\b/iu.test(body) ||
      /\b(?:dm|message|contact|follow|find|add)\s+(?:me|us|my)\b.{0,45}\b(?:instagram|insta|tiktok|snapchat|discord|telegram|whatsapp|wechat|twitter|threads|kakaotalk|weverse|x)\b/iu.test(body) ||
      /\b(?:kakao(?:talk)?|telegram|discord|instagram|insta|snapchat|tiktok|whatsapp|wechat|twitter|threads|weverse)\s+(?:id|handle|username|user)\s*[:=]\s*@?[\w.-]{2,}/iu.test(body) ||
      /\b(?:kakao(?:talk)?|telegram|discord|instagram|insta|snapchat|tiktok|whatsapp|wechat|twitter|threads|weverse)\s*[:=]\s*@[\w.-]{2,}/iu.test(body) ||
      /\b\d{1,5}\s+(?:[\p{L}]+\s+){1,3}(?:street|st|avenue|ave|road|rd|lane|ln|boulevard|blvd)\b/iu.test(body)) {
    return { ok: false, error: "Please do not share contact details or meeting addresses in chat." };
  }
  if (/\b(?:i['’]?m|i am|we['’]?re|we are)\s+(?:an?\s+)?(?:aegyo|myosin)\s+(?:admin|moderator|staff|support)\b/iu.test(body) ||
      /\b(?:send|share|give)\s+(?:me|us)\s+(?:your\s+)?(?:login|verification|one[- ]time|2fa)?\s*(?:code|password)\b/iu.test(body)) {
    return { ok: false, error: "Staff will never ask for login codes or passwords in chat." };
  }
  if (/\b(?:i['’]?m|i am)\s+(?:1[0-5]|[1-9])(?:\s*(?:years? old|yo))?\b/iu.test(body) ||
      /\b(?:tengo|soy)\s+(?:1[0-5]|[1-9])\s*a(?:ñ|n)os?\b/iu.test(body)) {
    return { ok: false, error: "Chat is for fans aged 16 or older." };
  }
  const repeatedCharacter = body.match(/(.)\1{11,}/u);
  if ((repeatedCharacter && !/[ㅋㅎᄏᄒ]/u.test(repeatedCharacter[1])) || /\b(\S+)(?:\s+\1){5,}\b/iu.test(body)) {
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
      Object.values(categories).some((active) => typeof active !== "boolean")) throw new Error("moderation_invalid_response");
  if (result.flagged === false) return Object.values(categories).some((active) => active === true) || shouldHoldChatBody(_body) ? "held" : "visible";
  if (result.flagged !== true) throw new Error("moderation_invalid_response");
  // A flagged message stays private even when a score is near the threshold.
  // Moderators can approve fandom slang without risking an automatic publish.
  return "held";
}

export function shouldHoldChatBody(body: string): boolean {
  return /\b(?:everyone|all of us|let['’]?s)\s+(?:mass\s+)?report\b|\b(?:pile on|dogpile|harass)\s+(?:this|that|the|a|her|him|them)\b/iu.test(body);
}

export async function classifyChatBody(body: string): Promise<"visible" | "held"> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("moderation_missing_key");
  const response = await fetch("https://api.openai.com/v1/moderations", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: "omni-moderation-latest", input: body }),
    signal: AbortSignal.timeout(6000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`moderation_http_${response.status}`);
  const data = await response.json() as { results?: ModerationResult[] };
  const result = data.results?.[0];
  if (!result) throw new Error("moderation_invalid_response");
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
