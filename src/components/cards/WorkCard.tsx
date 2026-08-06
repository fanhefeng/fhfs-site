import { useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import type { Work } from "@/lib/content";
import { SpecularEdge } from "./SpecularEdge";

type Props = {
  work: Work;
  locale: Locale;
  /** Accent used as the specular light colour; defaults to the site amber. */
  accent?: string;
};

/**
 * One piece in the gallery: a glass plate with mono year, title, note and
 * tags. Hover lights the edge in the project's own colour — SpecularEdge is
 * the client island; this card renders on the server.
 */
export function WorkCard({ work, locale, accent = "var(--accent)" }: Props) {
  const t = useTranslations("portfolio");

  return (
    <article className="group relative isolate flex flex-col rounded-card glass-thin p-6">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-heading vibrancy">{work.title[locale]}</h3>
        <span className="shrink-0 font-mono text-meta tracking-meta text-fg-tertiary">
          {work.year}
        </span>
      </div>
      <p className="mt-3 flex-1 text-caption leading-relaxed text-fg-secondary">
        {work.description[locale]}
      </p>
      {work.tags.length > 0 && (
        <ul className="mt-4 flex flex-wrap gap-2">
          {work.tags.map((tag) => (
            <li
              key={tag}
              className="rounded-chip border border-line px-2.5 py-1 font-mono text-meta tracking-meta text-fg-tertiary"
            >
              {tag}
            </li>
          ))}
        </ul>
      )}
      {work.url && (
        <a
          href={work.url}
          target="_blank"
          rel="noopener noreferrer"
          className="hit-ext mt-5 inline-flex w-fit items-center gap-1.5 text-caption text-fg-secondary underline decoration-accent/50 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
        >
          {t("visit")}
          <span aria-hidden="true">↗</span>
        </a>
      )}
      <SpecularEdge color={accent} />
    </article>
  );
}
