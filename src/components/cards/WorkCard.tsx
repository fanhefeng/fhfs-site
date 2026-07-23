import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { Work } from "content-collections";

export function WorkCard({ work, locale }: { work: Work; locale: Locale }) {
  const t = useTranslations("portfolio");

  return (
    <article className="neon-card flex flex-col p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-deco text-xl tracking-wide text-fg">
          {work.title[locale]}
        </h2>
        <span className="shrink-0 text-xs text-gold/80">{work.year}</span>
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-muted-fg">
        {work.description[locale]}
      </p>
      {work.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {work.tags.map((tag) => (
            <span
              key={tag}
              className="rounded-full border border-line px-2.5 py-0.5 text-xs text-muted-fg"
            >
              {tag}
            </span>
          ))}
        </div>
      )}
      {work.url && (
        <a
          href={work.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-block text-sm text-neon-blue transition-all hover:[text-shadow:var(--glow-blue)]"
        >
          {t("visit")} →
        </a>
      )}
    </article>
  );
}
