import { getSession } from "@/lib/auth";
import { hasAegyoAccountSession } from "@/lib/chat-policy";

// The shared Aegyo Accounts branch accepts `sensitive: true` and rechecks the
// provider session. The current legacy adapter ignores this optional argument.
export function getChatSession() {
  const read = getSession as (options?: { sensitive?: boolean }) => ReturnType<typeof getSession>;
  return read({ sensitive: true }).then((session) => hasAegyoAccountSession(session) ? session : null);
}
