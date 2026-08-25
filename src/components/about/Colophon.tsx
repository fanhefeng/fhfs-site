"use client";

import { useTranslations } from "next-intl";
import { useLocalClock } from "@/lib/useLocalClock";

/** The page's last line: where and when it was written. No motion — only
 *  the clock ticks, once a minute. */
export function Colophon({ className }: { className?: string }) {
  const t = useTranslations("about");
  const time = useLocalClock();

  return (
    <p
      className={`border-t border-line pt-6 font-mono text-meta uppercase tracking-meta text-fg-tertiary [font-variant-numeric:tabular-nums] ${className ?? ""}`}
    >
      {t("colophon", { time: time ?? "--:--" })}
    </p>
  );
}
