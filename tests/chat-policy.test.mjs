import { test } from "node:test";
import assert from "node:assert/strict";
import { canWriteChatInEnvironment, chatDisplayName, classifyChatBody, decideModeration, hasAegyoAccountSession, sameOrigin, shouldHoldChatBody, validateChatBody } from "../lib/chat-policy.ts";

test("normalizes text and rejects links, contact details, and repeated spam", () => {
  assert.equal(validateChatBody("  hello   Aegyo  ").ok, true);
  assert.equal(validateChatBody("first line\nsecond line").body, "first line\nsecond line");
  assert.equal(validateChatBody("hello https://example.com").ok, false);
  assert.equal(validateChatBody("join discord.gg/fans").ok, false);
  assert.equal(validateChatBody("join discord[.]gg/fans").ok, false);
  assert.equal(validateChatBody("email me at fan@example.com").ok, false);
  assert.equal(validateChatBody("Email me at fanname at gmail dot com").ok, false);
  assert.equal(validateChatBody("DM me on Instagram @fanparty").ok, false);
  assert.equal(validateChatBody("DM me on X @fanparty").ok, false);
  assert.equal(validateChatBody("kakao id: fanparty").ok, false);
  assert.equal(validateChatBody("telegram: @fanparty").ok, false);
  for (const contact of ["kakao: kimbias", "line id: kimbias", "line app: kimbias", "add me on line", "snap: kimbias99", "add me on kakao kimbias"]) {
    assert.equal(validateChatBody(contact).ok, false, contact);
  }
  assert.equal(validateChatBody("Call me at 1234567890").ok, false);
  assert.equal(validateChatBody("Come to 123 Main Street after the show").ok, false);
  assert.equal(validateChatBody("I am an Aegyo admin. Send me your login code.").ok, false);
  assert.equal(validateChatBody("I am 15 years old and love this group").ok, false);
  assert.equal(validateChatBody("Im 14 years old and love Stray Kids").ok, false);
  assert.equal(validateChatBody("tengo 14 años").ok, false);
  assert.equal(validateChatBody("Contact me on Inst\u200bagram").ok, false);
  assert.equal(validateChatBody("aaaaaaaaaaaaaaaaaaaa").ok, false);
  assert.equal(validateChatBody("hi ".repeat(7)).ok, false);
  for (const normal of ["BTS.ARMY forever", "debuted 2013 2014 2015", "ㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋㅋ", "we did 3 road trips", "🔥", "I'm 5 minutes late to the stream", "i'm 2 excited for this", "I am 1 of the OT7 stans", "I'm 12 years into stanning", "it has 120000000 views", "the rap line: absolute fire", "dance line: unmatched", "vocal line = best line", "best line: saranghae forever", "my favorite line: you are my universe", "find my favorite line in the chorus", "follow my line of thought here", "add me to the vocal line fan club"]) {
    assert.equal(validateChatBody(normal).ok, true, normal);
  }
  assert.equal(chatDisplayName("  Moonlight   Star  "), "Moonlight Star");
  assert.match(chatDisplayName("Moonlight Star", "user-123"), /^[0-9a-f]{6} · Moonlight Star$/);
  assert.equal([...chatDisplayName("A".repeat(32), "user-123")].length, 32);
  assert.equal(chatDisplayName("fan@example.com"), "Fan");
  assert.match(chatDisplayName("fan@example.com", "user-123"), /^Fan-[0-9a-f]{6}$/);
  assert.match(chatDisplayName("Aegyo Admin", "user-123"), /^Fan-[0-9a-f]{6}$/);
  for (const impersonation of ["Aegyo Team", "Aegyo Mod", "Admins", "0fficial", "Aegyo", "AegyoArena", "Myosin"]) {
    assert.match(chatDisplayName(impersonation, "user-123"), /^Fan-[0-9a-f]{6}$/, impersonation);
  }
  process.env.AEGYO_APP_ORIGIN = "https://www.aegyoarena.com";
  assert.equal(sameOrigin(new Request("https://internal.railway.app/api/chat", { headers: { origin: "https://www.aegyoarena.com", "x-forwarded-host": "www.aegyoarena.com", "x-forwarded-proto": "https" } })), true);
  process.env.AEGYO_APP_ORIGIN = "https://aegyoarena.com";
  assert.equal(sameOrigin(new Request("https://internal.railway.app/api/chat", { headers: { origin: "https://www.aegyoarena.com", "x-forwarded-host": "www.aegyoarena.com", "x-forwarded-proto": "https" } })), true);
  assert.equal(sameOrigin(new Request("https://internal.railway.app/api/chat", { headers: { origin: "https://aegyoarena.com", "x-forwarded-host": "aegyoarena.com", "x-forwarded-proto": "https" } })), true);
  assert.equal(sameOrigin(new Request("https://internal.railway.app/api/chat", { headers: { origin: "https://www.aegyoarena.com", "x-forwarded-host": "aegyoarena.com", "x-forwarded-proto": "https" } })), false);
  assert.equal(sameOrigin(new Request("https://internal.railway.app/api/chat", { headers: { origin: "https://evil.test", "x-forwarded-host": "www.aegyoarena.com", "x-forwarded-proto": "https" } })), false);
  assert.equal(sameOrigin(new Request("https://internal.railway.app/api/chat", { headers: { origin: "https://www.aegyoarena.com", "x-forwarded-host": "evil.test", "x-forwarded-proto": "https" } })), false);
  assert.equal(hasAegyoAccountSession({ user: { email: "fan@example.com" }, providerSessionId: "provider-session" }), true);
  assert.equal(hasAegyoAccountSession({ user: { email: "fan@example.com", emailVerified: true } }), false);
});

test("preview write allowlist defaults open and restricts configured testers", () => {
  const original = process.env.AEGYO_CHAT_WRITE_ALLOWLIST;
  try {
    delete process.env.AEGYO_CHAT_WRITE_ALLOWLIST;
    assert.equal(canWriteChatInEnvironment("fan@example.com"), true);
    process.env.AEGYO_CHAT_WRITE_ALLOWLIST = "mateo@myosin.xyz, simon@myosin.xyz";
    assert.equal(canWriteChatInEnvironment("MATEO@myosin.xyz"), true);
    assert.equal(canWriteChatInEnvironment("fan@example.com"), false);
    assert.equal(canWriteChatInEnvironment(undefined), false);
    process.env.AEGYO_CHAT_WRITE_ALLOWLIST = "";
    assert.equal(canWriteChatInEnvironment("mateo@myosin.xyz"), false);
  } finally {
    if (original === undefined) delete process.env.AEGYO_CHAT_WRITE_ALLOWLIST;
    else process.env.AEGYO_CHAT_WRITE_ALLOWLIST = original;
  }
});

test("all model-flagged content stays private until review", () => {
  const category = { flagged: true, categories: { harassment: true, hate: false }, category_scores: { harassment: 0.806 } };
  assert.equal(decideModeration("She's a bad bitch on stage, wow.", category), "held");
  assert.equal(decideModeration("You are a bad bitch", category), "held");
  assert.equal(decideModeration("That singer is a bitch", { ...category, category_scores: { harassment: 0.89 } }), "held");
  assert.equal(decideModeration("I will hurt you", { ...category, categories: { harassment: true, "harassment/threatening": true } }), "held");
  assert.equal(shouldHoldChatBody("Everyone mass report this fan"), true);
  assert.equal(decideModeration("Everyone mass report this fan", { flagged: false, categories: { harassment: false } }), "held");
});

test("moderation fails closed without a key or a valid result", async () => {
  const key = process.env.OPENAI_API_KEY;
  const fetchOriginal = globalThis.fetch;
  try {
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(classifyChatBody("Hello fans"));
    process.env.OPENAI_API_KEY = "test-key";
    globalThis.fetch = async () => new Response(JSON.stringify({ results: [{}] }), { status: 200 });
    await assert.rejects(classifyChatBody("Hello fans"));
    globalThis.fetch = async () => new Response(JSON.stringify({ results: [{ flagged: true }] }), { status: 200 });
    await assert.rejects(classifyChatBody("Hello fans"));
    globalThis.fetch = async () => new Response(JSON.stringify({ results: [{ flagged: true, categories: { harassment: true } }] }), { status: 200 });
    assert.equal(await classifyChatBody("Hello fans"), "held");
    globalThis.fetch = async () => new Response(JSON.stringify({ results: [{ flagged: false }] }), { status: 200 });
    await assert.rejects(classifyChatBody("Hello fans"));
    globalThis.fetch = async () => new Response(JSON.stringify({ results: [{ flagged: false, categories: { harassment: false } }] }), { status: 200 });
    assert.equal(await classifyChatBody("Hello fans"), "visible");
  } finally {
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
    globalThis.fetch = fetchOriginal;
  }
});
