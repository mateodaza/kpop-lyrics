import { test } from "node:test";
import assert from "node:assert/strict";
import { CHAT_RULES_VERSION, hasCurrentChatParticipation, validatesChatParticipationInput } from "../lib/chat-participation.ts";

test("posting requires both explicit age and rules confirmations", () => {
  assert.equal(validatesChatParticipationInput({ acceptRules: true, confirmAge16: true }), true);
  assert.equal(validatesChatParticipationInput({ acceptRules: true, confirmAge16: false }), false);
  assert.equal(validatesChatParticipationInput({ acceptRules: false, confirmAge16: true }), false);
  assert.equal(validatesChatParticipationInput(null), false);
  assert.equal(validatesChatParticipationInput({ acceptRules: "true", confirmAge16: true }), false);
});

test("new chat terms require renewed acceptance", () => {
  const accepted = { rulesVersion: CHAT_RULES_VERSION, age16ConfirmedAt: new Date() };
  assert.equal(hasCurrentChatParticipation(accepted), true);
  assert.equal(hasCurrentChatParticipation({ ...accepted, rulesVersion: "old" }), false);
  assert.equal(hasCurrentChatParticipation(null), false);
});
