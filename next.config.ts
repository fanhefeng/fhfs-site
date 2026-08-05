import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withContentCollections } from "@content-collections/next";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    // The root layout sits under [locale], so a URL matching no route at all
    // has no layout to render a segment-level not-found inside. This routes
    // those to app/global-not-found.tsx instead of Next's bare built-in page.
    globalNotFound: true,
  },
};

export default withContentCollections(withNextIntl(nextConfig));
