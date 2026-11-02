"use client";

import type { Locale } from "@/i18n/routing";
import type { NoteSummary } from "@/lib/notebook";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { htmlLang } from "@/i18n/routing";
import { Reveal } from "@/components/fx/Reveal";
import { SegmentedFilter } from "@/components/ui/SegmentedFilter";
import { useUrlChoice } from "@/lib/client/useUrlChoice";
import { filterNotes, NOTE_SECTIONS } from "@/lib/notebook";

export function Notebook({ data }: { data: { locale: Locale; notes: NoteSummary[] } }) {
  const { locale, notes } = data;
  const t = useTranslations("notebook");
  const [section, choose] = useUrlChoice("section", NOTE_SECTIONS);
  const [query, setQuery] = useState("");
  const visible = filterNotes(notes, section, query);
  const sections = NOTE_SECTIONS.filter((key) => !section || key === section);
  return (
    <main id="main" className="mx-auto w-full max-w-[960px] flex-1 px-6 pb-28 pt-32 md:pt-40">
      <Reveal as="header" className="mb-12 grid gap-6 md:grid-cols-[1fr_240px] md:items-end">
        <div>
          <Link
            href="/blog"
            className="hit-ext font-mono text-meta uppercase tracking-meta text-fg-secondary transition-colors hover:text-accent"
          >
            {t("backToBlog")} <span aria-hidden>↗</span>
          </Link>
          <p className="mb-3 mt-8 font-mono text-meta uppercase tracking-meta text-accent">
            {t("eyebrow")}
          </p>
          <h1 className="text-display-sm">{t("title")}</h1>
          <p className="mt-5 max-w-[36ch] text-body text-fg-secondary">{t("subtitle")}</p>
        </div>
        <p className="border-l border-line pl-5 text-small leading-relaxed text-fg-tertiary">
          {t("intro")}
        </p>
      </Reveal>

      <div className="mb-10 flex flex-col gap-5 border-y border-line py-5 sm:flex-row sm:items-center sm:justify-between">
        <SegmentedFilter
          options={[
            { value: "all", label: t("all") },
            ...NOTE_SECTIONS.map((value) => ({ value, label: t(`sections.${value}`) })),
          ]}
          value={section ?? "all"}
          onChange={(value) => choose(value === "all" ? null : value)}
          ariaLabel={t("filterAria")}
        />
        <label className="flex min-w-0 items-center gap-3 border-b border-line py-2 sm:max-w-56">
          <span aria-hidden className="text-fg-tertiary">
            ⌕
          </span>
          <span className="sr-only">{t("search")}</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={t("search")}
            className="min-w-0 w-full bg-transparent text-small text-fg outline-none placeholder:text-fg-tertiary focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-4"
          />
        </label>
      </div>
      <p
        aria-live="polite"
        role="status"
        className="mb-10 font-mono text-meta uppercase tracking-meta text-fg-tertiary"
      >
        {t("count", { count: visible.length })}
      </p>
      {visible.length === 0 && <p className="py-12 text-body text-fg-secondary">{t("empty")}</p>}
      {sections.map((key) => {
        const entries = visible.filter((note) => note.section === key);
        if (!entries.length) return null;
        return (
          <section
            key={key}
            aria-labelledby={`section-${key}`}
            className="mb-16 grid gap-x-10 md:grid-cols-[170px_1fr]"
          >
            <div className="mb-5">
              <p aria-hidden className="mb-3 font-mono text-meta text-accent">
                0{NOTE_SECTIONS.indexOf(key) + 1}
              </p>
              <h2 id={`section-${key}`} className="text-heading">
                {t(`sections.${key}`)}
              </h2>
              <p className="mt-3 max-w-[26ch] text-small leading-relaxed text-fg-tertiary">
                {t(`descriptions.${key}`)}
              </p>
            </div>
            <ol className="min-w-0 border-t border-line">
              {entries.map((note) => (
                <li key={note.slug} className="border-b border-line">
                  <Link href={`/blog/notes/${note.slug}`} className="group block py-6">
                    <div className="mb-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                      <span className="text-accent">{t(`formats.${note.format}`)}</span>
                      {note.date && <time dateTime={note.date}>{note.date}</time>}
                      <span>{t("readingTime", { minutes: note.readingMinutes })}</span>
                      <span>{note.locale.toUpperCase()}</span>
                    </div>
                    <div className="flex items-start justify-between gap-4">
                      <h3
                        lang={htmlLang(note.locale)}
                        className="text-[1.3125rem] font-medium leading-snug tracking-tight transition-colors group-hover:text-accent group-focus-visible:text-accent"
                      >
                        {note.title}
                      </h3>
                      <span
                        aria-hidden
                        className="shrink-0 text-fg-tertiary transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none"
                      >
                        ↗
                      </span>
                    </div>
                    <p className="mt-3 text-small leading-relaxed text-fg-secondary">
                      {note.summary[locale]}
                    </p>
                    <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 font-mono text-meta text-fg-tertiary">
                      {note.tags.map((tag) => (
                        <span key={tag}>#{tag}</span>
                      ))}
                    </p>
                  </Link>
                </li>
              ))}
            </ol>
          </section>
        );
      })}
    </main>
  );
}
