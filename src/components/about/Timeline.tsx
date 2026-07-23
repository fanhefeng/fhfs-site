import type { Locale } from "@/i18n/routing";
import { getTimeline } from "@/lib/content";

export function Timeline({ locale }: { locale: Locale }) {
  const entries = getTimeline();

  return (
    <ol className="relative ml-3 border-l border-gold/30">
      {entries.map((entry) => (
        <li key={entry._meta.path} className="relative mb-10 pl-8">
          <span
            aria-hidden
            className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-gold [box-shadow:var(--glow-gold)]"
          />
          <p className="text-xs tracking-widest text-gold/80">{entry.period}</p>
          <h3 className="mt-1 font-deco text-lg text-fg">
            {entry.title[locale]}
            {entry.org && (
              <span className="ml-2 text-sm text-muted-fg">@ {entry.org}</span>
            )}
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-muted-fg">
            {entry.description[locale]}
          </p>
        </li>
      ))}
    </ol>
  );
}
