import { redirect } from "next/navigation";
import { resolveAuthMode } from "./mode";

const SHARED_AUTH_ENTRY = "/api/auth/shared/login";

/**
 * Legacy auth pages remain available before cutover, but must never collect
 * credentials once shared auth is active. Closed modes intentionally stay on
 * the local page so the API can report the recoverable cutover outage.
 */
export async function enterSharedAuthWhenActive() {
  const mode = await resolveAuthMode();
  if (mode.kind === "shared") redirect(SHARED_AUTH_ENTRY);
  return mode.kind === "closed" && mode.reason === "cutover_freeze"
    ? "cutover_freeze"
    : "available";
}
