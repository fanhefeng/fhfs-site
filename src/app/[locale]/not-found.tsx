"use client";

import { useLocale, useTranslations } from "next-intl";
import { NotFoundStage } from "@/components/notfound/NotFoundStage";

/**
 * The `notFound()` boundary inside a locale.
 *
 * This is where an unknown post slug or tag lands: the segment renders, finds
 * nothing in the database, and calls `notFound()` — so the locale is known and
 * the page can speak one language. It used to be unreachable, back when every
 * dynamic route was `dynamicParams: false` and unknown params 404d at the
 * routing layer instead.
 *
 * A URL matching no route at all still never reaches here. Those are answered
 * by `app/global-not-found.tsx`, which has to offer both languages.
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
