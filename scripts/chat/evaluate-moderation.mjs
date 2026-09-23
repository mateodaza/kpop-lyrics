#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import { classifyChatBody } from "../../lib/chat-policy.ts";

if (!process.env.OPENAI_API_KEY) {
  process.stderr.write("OPENAI_API_KEY is required for the live moderation evaluation.\n");
  process.exit(2);
}
const cases = JSON.parse(await readFile(new URL("../../tests/chat-moderation-cases.json", import.meta.url), "utf8"));
let failures = 0;
for (const item of cases) {
  try {
    const actual = await classifyChatBody(item.text);
    const ok = actual === item.expected;
    process.stdout.write(`${ok ? "PASS" : "FAIL"} ${item.id}: ${actual} (expected ${item.expected})\n`);
    if (!ok) failures++;
  } catch {
    process.stdout.write(`ERROR ${item.id}: moderation endpoint unavailable\n`);
    failures++;
  }
}
process.exitCode = failures ? 1 : 0;
