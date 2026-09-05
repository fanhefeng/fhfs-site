"use client";

import { useEffect } from "react";
import { routing, htmlLang } from "@/i18n/routing";
import { ThemeInitScript } from "./ThemeInitScript";
import { site } from "@/config/site";
import zh from "../../messages/zh.json";
import en from "../../messages/en.json";
import { fontVariables } from "./fonts";
import "./globals.css";

/**
 * The error boundary above the root layout.
 *
 * `[locale]/error.tsx` catches what a page throws, but the layout itself
 * reads the database too (the nav table), and an error there has no layout
 * left to render inside — the same reason `global-not-found.tsx` exists.
 * So, like that file, this one returns a whole document, dresses itself, and
 * speaks both languages rather than guessing which one the reader wanted.
 * There is no intl provider here; copy comes straight from the catalogues.
 *
 * Only served by a production build — in development Next shows its own
 * overlay instead.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  const blocks = routing.locales.map((locale) => {
    const m = locale === "zh" ? zh : en;
    return { locale, lang: htmlLang(locale), ...m.error };
  });

  const action =
    "inline-flex min-h-11 items-center rounded-chip border border-line px-4 py-2.5 text-caption text-fg transition-colors hover:border-accent hover:text-accent";

  return (
    <html
      lang="zh-CN"
      suppressHydrationWarning
      className={`${fontVariables} h-full antialiased`}
    >
      <body className="min-h-dvh flex flex-col bg-bg text-fg">
        <ThemeInitScript />
        <main className="mx-auto flex w-full max-w-[880px] flex-1 flex-col justify-center gap-12 px-6 py-24 sm:flex-row sm:gap-16">
          {blocks.map((block) => (
            <section key={block.locale} lang={block.lang} className="flex-1">
              <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                {block.kicker}
              </p>
              <h1 className="mt-4 text-display-sm text-fg">{block.title}</h1>
              <p className="mt-4 max-w-[46ch] text-body text-fg-secondary">
                {block.description}
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <button type="button" onClick={reset} className={`${action} cursor-pointer`}>
                  {block.retry}
                </button>
                <a href={`/${block.locale}`} className={action}>
                  {block.backHome}
                </a>
              </div>
            </section>
          ))}
        </main>
        <footer className="px-6 pb-10 text-center font-mono text-caption tracking-meta text-fg-tertiary">
          {site.signName}
          {error.digest && <span className="ml-3">{error.digest}</span>}
        </footer>
      </body>
    </html>
  );
}
