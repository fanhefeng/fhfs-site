import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { PHASE_PRODUCTION_BUILD, PHASE_PRODUCTION_SERVER } from "next/constants";
import { contentSecurityPolicy } from "./src/lib/csp";
import { envProblems } from "./src/lib/env";
import { HASHED_ROUTES } from "./src/lib/immutable";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // The root layout sits under [locale], so a URL matching no route at all
    // has no layout to render a segment-level not-found inside. This routes
    // those to app/global-not-found.tsx instead of Next's bare built-in page.
    globalNotFound: true,
  },
  headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value: contentSecurityPolicy({ dev: process.env.NODE_ENV === "development" }),
          },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
      // A year, and only on an address with the content's hash in it — the
      // plain path to the same file revalidates (src/lib/immutable.ts).
      ...HASHED_ROUTES.map(({ source }) => ({
        source,
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      })),
    ];
  },
  rewrites() {
    return {
      // Before the filesystem is looked at: a hashed address is never a file
      // that exists, and `afterFiles` would first hand `/films/…` to the
      // [locale] routes.
      beforeFiles: HASHED_ROUTES,
      afterFiles: [],
      fallback: [],
    };
  },
  redirects() {
    return [
      // The grove was folded into the home page; old links still land.
      {
        source: "/:locale(zh|en)/grove",
        destination: "/:locale",
        permanent: true,
      },
      // The portfolio never had a work to hang; its device frames went back
      // to /software, which is where the page's one link pointed anyway.
      {
        source: "/:locale(zh|en)/portfolio",
        destination: "/:locale/software",
        permanent: true,
      },
      // The stage study — two cards in the moss — was folded into the
      // approach, which already stood the same two cards at the same
      // coordinates.
      {
        source: "/:locale(zh|en)/lab/grove-stage",
        destination: "/:locale/lab/approach",
        permanent: true,
      },
      // Three studies were retired — the album, the glow, the grain. Their
      // addresses land on the index rather than on a 404.
      {
        source: "/:locale(zh|en)/lab/:slug(album|aurora|grain)",
        destination: "/:locale/lab",
        permanent: true,
      },
      // The 大话西游 room moved into the films room when the second film
      // arrived; its old address still opens it.
      {
        source: "/:locale(zh|en)/odyssey",
        destination: "/:locale/films/odyssey",
        permanent: true,
      },
    ];
  },
};

/**
 * A production build or server refuses to start on a missing or mangled
 * variable, naming all of them at once (src/lib/env.ts). Left to themselves
 * they surface one by one — the admin's two not until somebody tries to log
 * in. `next dev` is another phase and is left alone. `next typegen` is not —
 * it loads this file as a production build — so it is told apart by name:
 * CI type-checks with no environment at all, and generating route types
 * reads nothing that needs one.
 */
export default function config(phase: string): NextConfig {
  const running = phase === PHASE_PRODUCTION_BUILD || phase === PHASE_PRODUCTION_SERVER;
  if (running && !process.argv.includes("typegen")) {
    const problems = envProblems(process.env);
    if (problems.length > 0) {
      throw new Error(`Environment not fit to run:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    }
  }
  return withNextIntl(nextConfig);
}
