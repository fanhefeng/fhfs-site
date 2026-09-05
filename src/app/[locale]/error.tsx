"use client";

import { useEffect } from "react";
import { useLocale, useTranslations } from "next-intl";
import { site } from "@/config/site";

/**
 * The error boundary inside a locale.
 *
 * Every page's render path reads the database, and none of those reads is
 * caught on purpose — a page that fails should fail loudly rather than serve
 * half of itself. This is where "loudly" lands for a reader: a prerendered
 * page never gets here, but the first request for an article published since
 * the last deploy, or a tag nobody had visited, runs the query live, and
 * Neon's free tier sleeps. Without this file that reader saw Next's bare
 * English error page.
 *
 * Kept plain on purpose — no GSAP, no canvas, nothing that could itself be
 * the thing that failed. `reset` re-renders the segment, which is the right
 * remedy for a cold database. Plain <a> for the way home, so the route
 * transition and the i18n Link are both out of the loop.
 */
export default function LocaleError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");
  const locale = useLocale();

  // The boundary swallows the error; keep it in the console, where a reader
  // reporting the page can still find something to quote.
  useEffect(() => {
    console.error(error);
  }, [error]);

  const action =
    "hit-ext inline-flex min-h-11 items-center rounded-chip border border-line px-4 py-2.5 text-caption text-fg transition-colors hover:border-accent hover:text-accent";

  return (
    <>
      {/* An error boundary cannot export metadata; React 19 hoists a <title>
          rendered here into <head>. */}
      <title>{`${t("title")} | ${site.signName}`}</title>
      <main
        id="main"
        className="mx-auto flex w-full max-w-[680px] flex-1 flex-col justify-center px-6 pb-28 pt-32"
      >
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t("kicker")}
        </p>
        <h1 className="mt-4 text-display-sm text-fg">{t("title")}</h1>
        <p className="mt-4 max-w-[46ch] text-body text-fg-secondary">
          {t("description")}
        </p>
        {/* Vercel's log line carries the same digest, so a reader who quotes
            it points straight at the cause. */}
        {error.digest && (
          <p className="mt-6 font-mono text-meta text-fg-tertiary">{error.digest}</p>
        )}
        <div className="mt-10 flex flex-wrap gap-4">
          <button type="button" onClick={reset} className={`${action} cursor-pointer`}>
            {t("retry")}
          </button>
          <a href={`/${locale}`} className={action}>
            {t("backHome")}
          </a>
        </div>
      </main>
    </>
  );
}
