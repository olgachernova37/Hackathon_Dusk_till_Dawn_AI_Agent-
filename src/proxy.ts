import { NextResponse, type NextRequest } from "next/server";
import { cookieName, defaultLocale, isLocale, type Locale } from "@/i18n/config";

/**
 * Locale negotiation. Every page lives under `app/[lang]`, so a request
 * without a locale prefix is redirected to the visitor's best match:
 * their remembered choice, then `Accept-Language`, then English.
 *
 * Renamed from `middleware` in Next 16 — see
 * node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md
 */

const YEAR_IN_SECONDS = 60 * 60 * 24 * 365;

/** Minimal `Accept-Language` parser — avoids pulling in Negotiator for 3 locales. */
function fromAcceptLanguage(header: string | null): Locale | undefined {
  if (!header) return undefined;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, ...params] = part.trim().split(";");
      const q = params.find((p) => p.trim().startsWith("q="));
      return { tag: tag.trim().toLowerCase(), q: q ? Number.parseFloat(q.split("=")[1]) : 1 };
    })
    .filter((entry) => entry.tag && !Number.isNaN(entry.q))
    .sort((a, b) => b.q - a.q);

  for (const { tag } of ranked) {
    // "cs-CZ" and "uk" both resolve on the primary subtag.
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }
  return undefined;
}

function negotiate(request: NextRequest): Locale {
  const remembered = request.cookies.get(cookieName)?.value;
  if (remembered && isLocale(remembered)) return remembered;
  return fromAcceptLanguage(request.headers.get("accept-language")) ?? defaultLocale;
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const segment = pathname.split("/")[1] ?? "";

  if (isLocale(segment)) {
    // Remember the language the visitor is actually browsing in, so the next
    // bare "/" lands on it instead of re-negotiating from headers.
    const response = NextResponse.next();
    if (request.cookies.get(cookieName)?.value !== segment) {
      response.cookies.set(cookieName, segment, { path: "/", maxAge: YEAR_IN_SECONDS, sameSite: "lax" });
    }
    return response;
  }

  const locale = negotiate(request);
  const url = request.nextUrl.clone();
  url.pathname = `/${locale}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  // Skip API routes, Next internals and anything with a file extension
  // (favicon.ico, /infinity-mark.svg and the rest of public/).
  matcher: ["/((?!api|_next|.*\\..*).*)"],
};
