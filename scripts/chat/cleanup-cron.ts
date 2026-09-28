// Railway Function: one short-lived execution per day.
const target = process.env.CHAT_CLEANUP_URL;
const secret = process.env.CHAT_CLEANUP_SECRET;

if (!target || !secret) throw new Error("Chat cleanup is not configured");

const response = await fetch(target, {
  method: "POST",
  headers: { Authorization: `Bearer ${secret}` },
  signal: AbortSignal.timeout(15_000),
});

if (!response.ok) throw new Error(`Chat cleanup returned ${response.status}`);
console.log("Chat cleanup completed");

export {};
