"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

/**
 * "HH:mm in Qingdao" — the same wall clock the footer keeps, borrowed for a
 * sign-off at the end of the About page. Formats Asia/Shanghai regardless of
 * the visitor's zone and re-renders on the minute, with the first tick
 * aligned to the next :00 so it never lags. Renders a placeholder until
 * mounted, so SSR and hydration agree.
 */
function useQingdaoTime(): string | null {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const fmt = new Intl.DateTimeFormat("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
      timeZone: "Asia/Shanghai",
    });
    const update = () => setTime(fmt.format(new Date()));
    update();

    let interval: number | undefined;
    const align = window.setTimeout(
      () => {
        update();
        interval = window.setInterval(update, 60_000);
      },
      (60 - new Date().getSeconds()) * 1000 + 100
    );
    return () => {
      window.clearTimeout(align);
      if (interval !== undefined) window.clearInterval(interval);
    };
  }, []);

  return time;
}

/** The page's last line: where and when it was written. Entirely static. */
export function Colophon({ className }: { className?: string }) {
  const t = useTranslations("about");
  const time = useQingdaoTime();

  return (
    <p
      className={`border-t border-line pt-6 font-mono text-meta uppercase tracking-meta text-fg-tertiary [font-variant-numeric:tabular-nums] ${className ?? ""}`}
    >
      {t("colophon", { time: time ?? "--:--" })}
    </p>
  );
}
