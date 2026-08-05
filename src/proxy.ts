import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { readSession, SESSION_COOKIE } from "./lib/auth/session";

const intlProxy = createMiddleware(routing);

/**
 * Two things share this file, and the order matters.
 *
 * `/admin` has to be handled and returned *before* next-intl sees it: the
 * routing config uses `localePrefix: "always"`, so anything without a locale
 * prefix gets redirected, and `/admin` would bounce to `/zh/admin` — a route
 * that does not exist.
 *
 * The check here is optimistic on purpose. This runs on every request,
 * prefetches included, so it verifies a signature and nothing more; it never
 * queries the database and it is not the authorisation boundary. That lives in
 * `requireAdmin()` at the top of each Server Action, because Server Actions
 * are not routes — moving one, or editing the matcher below, can take it out
 * of this file's reach without anything failing loudly.
 */
export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname === "/admin" || pathname.startsWith("/admin/")) {
    if (pathname === "/admin/login") return NextResponse.next();

    const session = await readSession(request.cookies.get(SESSION_COOKIE)?.value);
    if (!session) {
      const url = new URL("/admin/login", request.nextUrl);
      // So a bookmarked edit page comes back after signing in.
      if (pathname !== "/admin") url.searchParams.set("next", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  return intlProxy(request);
}

export const config = {
  // Skip api routes, Next internals and all static files. /admin is not
  // excluded — it needs the branch above.
  matcher: "/((?!api|_next|_vercel|.*\\..*).*)",
};
