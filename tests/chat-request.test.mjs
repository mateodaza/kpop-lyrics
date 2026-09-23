import { test } from "node:test";
import assert from "node:assert/strict";
import { readChatJson } from "../lib/chat-request.ts";

test("chat JSON reads valid small bodies and rejects oversized streaming bodies", async () => {
  const small = new Request("https://aegyoarena.com/api/chat", { method: "POST", body: JSON.stringify({ body: "hi" }) });
  assert.deepEqual(await readChatJson(small, 128), { value: { body: "hi" }, tooLarge: false });

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(new TextEncoder().encode("x".repeat(64)));
      controller.enqueue(new TextEncoder().encode("x".repeat(65)));
      controller.close();
    },
  });
  const large = new Request("https://aegyoarena.com/api/chat", { method: "POST", body: stream, duplex: "half" });
  assert.deepEqual(await readChatJson(large, 128), { value: null, tooLarge: true });
});
