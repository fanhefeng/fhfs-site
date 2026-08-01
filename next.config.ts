import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withContentCollections } from "@content-collections/next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // The root layout sits under [locale] and every dynamic route is
    // dynamicParams: false, so unmatched URLs 404 before any segment renders
    // and never reach a segment-level not-found. This routes them to
    // app/global-not-found.tsx instead of Next's bare built-in page.
    globalNotFound: true,
  },
};

export default withContentCollections(withNextIntl(nextConfig));
