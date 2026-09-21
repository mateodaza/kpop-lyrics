type Env = Readonly<Record<string, string | undefined>>;
type RequestShape = { method: string; pathname: string };

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const FREEZE_EXEMPT_PATHS = new Set([
  // This endpoint remains safe during the freeze: resolveAuthMode prevents its
  // database delete, while it still expires the user's local browser cookie.
  "/api/auth/logout",
]);

export function shouldBlockForAuthCutover(
  request: RequestShape,
  env: Env = process.env,
) {
  if (env.AEGYO_AUTH_CUTOVER_FREEZE !== "true") return false;
  if (!WRITE_METHODS.has(request.method.toUpperCase())) return false;
  const pathname = request.pathname.replace(/\/+$/, "") || "/";
  return pathname.startsWith("/api/") && !FREEZE_EXEMPT_PATHS.has(pathname);
}
