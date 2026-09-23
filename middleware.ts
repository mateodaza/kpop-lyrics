import { NextRequest, NextResponse } from "next/server";
import { shouldBlockForAuthCutover } from "@/lib/shared-auth/write-freeze";

// Geo language router: default Latin-American (and Spanish-speaking) visitors to
// Spanish. Railway doesn't inject a client-country header, so we read one IF the
// infra ever provides it (Cloudflare's cf-ipcountry, Vercel's x-vercel-ip-country,
// etc.) and otherwise fall back to Accept-Language, which is always present and
// already flags most LatAm traffic (devices set to es-* / pt-BR).
//
// This only SEEDS a default (the `aegyo_geo` hint cookie). An explicit toggle
// choice lives in the separate `aegyo-lang` cookie and always wins — the hint
// never overrides it (see components/LangProvider.tsx).

const SPANISH_COUNTRIES = new Set([
  // Latin America (Spanish)
  "MX", "GT", "HN", "SV", "NI", "CR", "PA", "CO", "VE", "EC", "PE", "BO",
  "CL", "AR", "PY", "UY", "DO", "CU", "PR",
  "BR", // Brazil → the site's non-English language is Spanish (better than English for BR)
  "ES", "GQ", // Spain, Equatorial Guinea (Spanish-speaking)
]);

function countryHeader(req: NextRequest): string | null {
  const h = req.headers;
  const c =
    h.get("cf-ipcountry") ||          // Cloudflare
    h.get("x-vercel-ip-country") ||   // Vercel
    h.get("x-country") ||
    h.get("x-geo-country") ||
    h.get("x-appengine-country");     // GCP
  return c ? c.trim().toUpperCase() : null;
}

function langFromAcceptLanguage(al: string | null): "es" | "en" | null {
  if (!al) return null;
  const first = al.split(",")[0]?.trim().toLowerCase() ?? "";
  if (first.startsWith("es")) return "es"; // Spanish (es-MX, es-AR, es-419, es-ES…)
  if (first.startsWith("pt")) return "es"; // Portuguese (Brazil) → site's Spanish
  return null;
}

function withRailwayNoIndex(req: NextRequest, response: NextResponse): NextResponse {
  // Railway preview domains use the live database but are never canonical pages.
  if (req.nextUrl.hostname.endsWith(".up.railway.app")) response.headers.set("X-Robots-Tag", "noindex, nofollow, noarchive");
  return response;
}

export function middleware(req: NextRequest) {
  if (process.env.AEGYO_CHAT_WRITE_ALLOWLIST !== undefined && req.nextUrl.hostname.endsWith(".up.railway.app") && !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      !/^\/api\/(?:chat(?:\/(?:participation|report|cleanup))?|admin\/chat|auth\/(?:logout|shared\/logout))$/.test(req.nextUrl.pathname)) {
    return withRailwayNoIndex(req, NextResponse.json(
      { code: "preview_read_only", error: "This preview does not accept site changes." },
      { status: 403, headers: { "Cache-Control": "no-store" } },
    ));
  }
  if (
    shouldBlockForAuthCutover({
      method: req.method,
      pathname: req.nextUrl.pathname,
    })
  ) {
    return withRailwayNoIndex(req, NextResponse.json(
      {
        code: "cutover_freeze",
        error: "This action is temporarily unavailable. Please try again shortly.",
      },
      {
        status: 503,
        headers: {
          "cache-control": "no-store",
          "retry-after": "60",
        },
      },
    ));
  }

  // API reads and unfrozen writes should retain their existing behavior. Geo
  // language cookies are page-only and must not be added to API responses.
  if (req.nextUrl.pathname.startsWith("/api/")) return withRailwayNoIndex(req, NextResponse.next());

  // Respect any prior decision — an explicit choice or an already-seeded hint.
  if (req.cookies.get("aegyo-lang") || req.cookies.get("aegyo_geo")) {
    return withRailwayNoIndex(req, NextResponse.next());
  }

  const country = countryHeader(req);
  const lang: "es" | "en" | null = country
    ? SPANISH_COUNTRIES.has(country) ? "es" : "en"
    : langFromAcceptLanguage(req.headers.get("accept-language"));

  const res = NextResponse.next();
  if (lang) {
    res.cookies.set("aegyo_geo", lang, {
      path: "/",
      maxAge: 60 * 60 * 24 * 180, // 180 days
      sameSite: "lax",
    });
  }
  return withRailwayNoIndex(req, res);
}

// Run on pages and APIs, while skipping static assets and the image optimizer.
// API requests pass through unchanged unless the auth cutover freeze blocks a
// mutating request above.
export const config = {
  matcher: ["/((?!_next|.*\\.[a-zA-Z0-9]+$).*)"],
};
