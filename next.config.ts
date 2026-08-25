import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Static assets that are never edited in place — a new model or video gets a
 * new file name — so a browser may keep them for as long as it likes.
 */
const IMMUTABLE_PATHS = [
  "/lab/scroll-video/:path*",
  "/models/:path*",
  "/draco/:path*",
  "/grove/:path*",
  "/lab/dissolve/:path*",
  "/portfolio/:path*",
];

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
      ...IMMUTABLE_PATHS.map((source) => ({
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
  redirects() {
    return [
      // The grove was folded into the home page; old links still land.
      {
        source: "/:locale(zh|en)/grove",
        destination: "/:locale",
        permanent: true,
      },
    ];
  },
};

export default withNextIntl(nextConfig);
