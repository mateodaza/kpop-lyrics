type Env = Readonly<Record<string, string | undefined>>;
type RequestShape = { method: string; pathname: string };

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const FREEZE_EXEMPT_PATHS = new Set([
  // This endpoint remains safe during the freeze: resolveAuthMode prevents its
  // database delete, while it still expires the user's local browser cookie.
  "/api/auth/logout",
]);

// Reviewed 2026-09-21. These GET handlers can mutate the database, call a
// provider with side effects, or both. Bracketed segments match one path part.
export const CUTOVER_GET_WRITER_PATHS = [
  "/api/admin/annotations",
  "/api/admin/digest",
  "/api/admin/event-registrations",
  "/api/admin/event-registrations/sync",
  "/api/admin/giveaway-entries",
  "/api/admin/i18n",
  "/api/admin/lyrics",
  "/api/admin/pc-artist-index",
  "/api/admin/pc-index",
  "/api/admin/poll-results",
  "/api/admin/slang-media",
  "/api/auth/shared/callback",
  "/api/events/register",
  "/api/follow",
  "/api/giveaway",
  "/api/le-sserafim",
  "/api/polls/[slug]",
  "/api/polls/[slug]/timeseries",
  "/api/restock-alert",
  "/api/tips",
  "/api/vote",
] as const;

function matchesRoutePattern(pattern: string, pathname: string) {
  const expected = pattern.split("/");
  const actual = pathname.split("/");
  return (
    expected.length === actual.length &&
    expected.every(
      (part, index) =>
        (part.startsWith("[") && part.endsWith("]") && !!actual[index]) ||
        part === actual[index],
    )
  );
}

export function shouldBlockForAuthCutover(
  request: RequestShape,
  env: Env = process.env,
) {
  if (env.AEGYO_AUTH_CUTOVER_FREEZE !== "true") return false;
  const pathname = request.pathname.replace(/\/+$/, "") || "/";
  const method = request.method.toUpperCase();
  if (
    WRITE_METHODS.has(method) &&
    pathname.startsWith("/api/") &&
    !FREEZE_EXEMPT_PATHS.has(pathname)
  )
    return true;
  return (
    method === "GET" &&
    CUTOVER_GET_WRITER_PATHS.some((pattern) =>
      matchesRoutePattern(pattern, pathname),
    )
  );
}
