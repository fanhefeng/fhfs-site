"use client";

import { useEffect, useState } from "react";

/**
 * "HH:mm in Qingdao" — the wall clock the footer and the About colophon
 * share. Formats wall time for Asia/Shanghai regardless of the visitor's
 * zone and re-renders on the minute (first tick aligned to the next :00 so
 * it never drifts a minute behind). Returns null until mounted, so SSR and
 * hydration agree — render a placeholder for it.
 */
export function useQingdaoTime(): string | null {
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
