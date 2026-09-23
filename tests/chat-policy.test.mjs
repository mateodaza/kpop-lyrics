import { test } from "node:test";
import assert from "node:assert/strict";
import { chatDisplayName, classifyChatBody, decideModeration, hasAegyoAccountSession, sameOrigin, validateChatBody } from "../lib/chat-policy.ts";

test("normalizes text and rejects links, contact details, and repeated spam", () => {
  assert.equal(validateChatBody("  hello   Aegyo  ").ok, true);
  assert.equal(validateChatBody("first line\nsecond line").body, "first line\nsecond line");
  assert.equal(validateChatBody("hello https://example.com").ok, false);
  assert.equal(validateChatBody("join discord.gg/fans").ok, false);
  assert.equal(validateChatBody("email me at fan@example.com").ok, false);
  assert.equal(validateChatBody("aaaaaaaaaaaaaaaaaaaa").ok, false);
  assert.equal(validateChatBody("hi ".repeat(7)).ok, false);
  assert.equal(chatDisplayName("  Moonlight   Star  "), "Moonlight Star");
  assert.equal(chatDisplayName("fan@example.com"), "Fan");
  process.env.AEGYO_APP_ORIGIN = "https://www.aegyoarena.com";
  assert.equal(sameOrigin(new Request("https://internal.railway.app/api/chat", { headers: { origin: "https://www.aegyoarena.com", "x-forwarded-host": "www.aegyoarena.com", "x-forwarded-proto": "https" } })), true);
  assert.equal(sameOrigin(new Request("https://internal.railway.app/api/chat", { headers: { origin: "https://evil.test", "x-forwarded-host": "www.aegyoarena.com", "x-forwarded-proto": "https" } })), false);
  assert.equal(sameOrigin(new Request("https://internal.railway.app/api/chat", { headers: { origin: "https://www.aegyoarena.com", "x-forwarded-host": "evil.test", "x-forwarded-proto": "https" } })), false);
  assert.equal(hasAegyoAccountSession({ user: { email: "fan@example.com" }, providerSessionId: "provider-session" }), true);
  assert.equal(hasAegyoAccountSession({ user: { email: "fan@example.com", emailVerified: true } }), false);
});

test("moderation allows low-confidence indirect fan slang while holding directed abuse", () => {
  const category = { flagged: true, categories: { harassment: true, hate: false }, category_scores: { harassment: 0.806 } };
  assert.equal(decideModeration("She's a bad bitch on stage, wow.", category), "visible");
  assert.equal(decideModeration("You are a bad bitch", category), "held");
  assert.equal(decideModeration("That singer is a bitch", { ...category, category_scores: { harassment: 0.89 } }), "held");
  assert.equal(decideModeration("I will hurt you", { ...category, categories: { harassment: true, "harassment/threatening": true } }), "held");
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
    assert.equal(await classifyChatBody("Hello fans"), "held");
    globalThis.fetch = async () => new Response(JSON.stringify({ results: [{ flagged: false }] }), { status: 200 });
    assert.equal(await classifyChatBody("Hello fans"), "visible");
  } finally {
    if (key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = key;
    globalThis.fetch = fetchOriginal;
  }
});
