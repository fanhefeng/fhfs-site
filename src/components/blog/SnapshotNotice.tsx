import { site } from "@/config/site";
import type { Locale } from "@/i18n/routing";

export function SnapshotNotice({ locale, snapshotAt }: { locale: Locale; snapshotAt?: string }) {
  if (!snapshotAt) return null;
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: site.timeZone,
  }).format(new Date(snapshotAt));
  return (
    <p
      className="mb-6 border-b border-line pb-3 text-small text-fg-secondary"
      data-public-snapshot={snapshotAt}
    >
      {locale === "zh" ? "正在显示已发布的内容备份，更新于 " : "Showing a published copy from "}
      <time dateTime={snapshotAt}>{date}</time>
    </p>
  );
}
