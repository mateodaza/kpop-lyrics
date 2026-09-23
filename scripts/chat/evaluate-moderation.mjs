#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { classifyChatBody, validateChatBody } from "../../lib/chat-policy.ts";

if (!process.env.OPENAI_API_KEY) {
  process.stderr.write("OPENAI_API_KEY is required for the live moderation evaluation.\n");
  process.exit(2);
}
const cases = JSON.parse(await readFile(new URL("../../tests/chat-moderation-cases.json", import.meta.url), "utf8"));
let failures = 0;
for (const item of cases) {
  try {
    const checked = validateChatBody(item.text);
    const actual = checked.ok ? await classifyChatBody(checked.body) : "rejected";
    const allowed = Array.isArray(item.expected) ? item.expected : [item.expected];
    const ok = allowed.includes(actual);
    process.stdout.write(`${ok ? "PASS" : "FAIL"} ${item.id}: ${actual} (expected ${allowed.join(" or ")})\n`);
    if (!ok) failures++;
  } catch {
    process.stdout.write(`ERROR ${item.id}: moderation endpoint unavailable\n`);
    failures++;
  }
}
process.exitCode = failures ? 1 : 0;
