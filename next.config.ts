import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
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

export default withNextIntl(nextConfig);
