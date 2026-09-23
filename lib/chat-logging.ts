// Log enough to distinguish database, provider, and timeout failures without
// writing fan messages, account details, request bodies, or provider responses.
export function logChatFailure(operation: string, error: unknown) {
  const name = error instanceof Error ? error.name : "unknown";
  const providerCode = error instanceof Error && /^moderation_[a-z0-9_]+$/.test(error.message) ? error.message : undefined;
  const databaseCode = error && typeof error === "object" && "code" in error && typeof error.code === "string" && /^[A-Z0-9]{2,12}$/.test(error.code) ? error.code : undefined;
  console.error(`[chat] ${operation}`, { name, code: providerCode ?? databaseCode ?? "unknown" });
}
