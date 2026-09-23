import { test } from "node:test";
import assert from "node:assert/strict";
import { chatDisplayName, classifyChatBody, hasAegyoAccountSession, sameOrigin, validateChatBody } from "../lib/chat-policy.ts";

test("normalizes text and rejects links, contact details, and repeated spam", () => {
  assert.equal(validateChatBody("  hello   Aegyo  ").ok, true);
  assert.equal(validateChatBody("hello https://example.com").ok, false);
  assert.equal(validateChatBody("join discord.gg/fans").ok, false);
  assert.equal(validateChatBody("email me at fan@example.com").ok, false);
  assert.equal(validateChatBody("aaaaaaaaaaaaaaaaaaaa").ok, false);
  assert.equal(validateChatBody("hi ".repeat(7)).ok, false);
  assert.equal(chatDisplayName("  Moonlight   Star  "), "Moonlight Star");
  assert.equal(chatDisplayName("fan@example.com"), "Fan");
  assert.equal(sameOrigin(new Request("https://aegyoarena.com/api/chat", { headers: { origin: "https://aegyoarena.com" } })), true);
  assert.equal(sameOrigin(new Request("https://aegyoarena.com/api/chat", { headers: { origin: "http://aegyoarena.com" } })), false);
  assert.equal(hasAegyoAccountSession({ user: { email: "fan@example.com" }, providerSessionId: "provider-session" }), true);
  assert.equal(hasAegyoAccountSession({ user: { email: "fan@example.com", emailVerified: true } }), false);
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
