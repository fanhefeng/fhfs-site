"use client";

import { useLocale, useTranslations } from "next-intl";
import { NotFoundStage } from "@/components/notfound/NotFoundStage";

/**
 * The `notFound()` boundary inside a locale.
 *
 * Unmatched URLs never reach here — every dynamic route is
 * `dynamicParams: false`, so an unknown param 404s at the routing layer,
 * before any segment renders. Those are served by `app/global-not-found.tsx`.
 * This stays as the boundary for a page that calls `notFound()` itself, where
 * the locale *is* known and the page can speak one language.
 */
export default function NotFoundPage() {
  const t = useTranslations("notFound");
  const locale = useLocale();
  const prefix = `/${locale}`;

  return (
    <NotFoundStage
      blocks={[
        {
          lang: locale === "zh" ? "zh-CN" : "en",
          title: t("title"),
          description: t("description"),
          homeHref: prefix,
          homeLabel: t("backHome"),
          blogHref: `${prefix}/blog`,
          blogLabel: t("readInstead"),
        },
      ]}
      sticker={{
        lang: locale === "zh" ? "zh-CN" : "en",
        hint: t("stickerHint"),
        aria: t("stickerAria"),
        secret: t("stickerSecret"),
      }}
    />
  );
}
