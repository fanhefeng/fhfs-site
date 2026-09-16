import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/**
 * Static assets that are never edited in place — a new model or video gets a
 * new file name — so a browser may keep them for as long as it likes.
 */
const IMMUTABLE_PATHS = [
  // The Yozai slices: a Chinese page fetches thirty to fifty of them, and
  // without this every visit re-validated each one. Re-splitting the font
  // goes into a new folder name, never over these files.
  "/fonts/:path*",
  "/lab/scroll-video/:path*",
  "/models/:path*",
  "/draco/:path*",
  "/grove/:path*",
  "/lab/dissolve/:path*",
  "/lab/neon/:path*",
  "/idols/:path*",
  "/films/:path*",
  // The theme, three megabytes of it: re-encoding goes into a new file name.
  "/music/:path*",
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
