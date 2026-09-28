"use client";

import { useLocale, useTranslations } from "next-intl";
import { SidewaysBand } from "@/components/fx/SidewaysBand";

/**
 * The manifesto, crossing the screen inside /about.
 *
 * The site's one pinned *passage* (the cover's approach pins a window, not a
 * line): on a desktop pointer the slogan and its echo in the other language
 * ride sideways across a pinned screen, each character tumbling into place as
 * it crosses; on a phone the two lines simply fade up in the column. The
 * mechanism is `SidewaysBand`, which the lab also shows on its own; this file
 * only supplies the copy.
 *
 * It was cut for a while in favour of an in-place tumble — the reasoning was
 * that one pin per site is enough — and put back because the passage is what
 * README and DESIGN.md promise the page has, and the reader asked for it.
 */
export function ManifestoBand() {
  const t = useTranslations("home");
  const locale = useLocale();

  return (
    <SidewaysBand
      resplitKey={locale}
      lines={[
        {
          text: t("slogan"),
          className:
            "text-display-sm md:text-[clamp(3rem,8vw,7rem)] md:leading-[1.08] md:font-[650] md:tracking-[-0.03em]",
        },
        // The echo is always the other language — tagged so the CJK tracking
        // guard in globals.css picks the right rule.
        {
          text: t("sloganEcho"),
          lang: locale === "zh" ? "en" : "zh-CN",
          className:
            "no-cjk-oblique mt-4 font-serif text-title italic text-fg-secondary md:text-[clamp(1.5rem,3vw,2.75rem)]",
        },
      ]}
    />
  );
}
