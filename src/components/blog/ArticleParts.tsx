import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { htmlLang, type Locale } from "@/i18n/routing";
import { HAS_CJK } from "@/lib/reading";

/**
 * The pieces an article page and a secret's page share around the text. They
 * were written out twice, word for word; the pages still own their headers,
 * which differ (a secret has a kind, a length, a record).
 */

/** The standfirst: serif, and italic unless it is CJK — CJK has no true
 *  italic, and the synthesised slant reads as broken. */
export function ArticleSummary({ children }: { children: string }) {
  return (
    <p
      className={`mt-5 font-serif text-[1.1875rem] leading-relaxed text-fg-secondary ${
        HAS_CJK.test(children) ? "" : "italic"
      }`}
    >
      {children}
    </p>
  );
}

/** Said over a fallback render — the other language's text under this
 *  locale's address — in the page's own language, whatever the text's. */
export function FallbackNotice({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <p
      lang={htmlLang(locale)}
      className="glass-thin vibrancy mb-10 rounded-card px-4 py-3 text-caption"
    >
      {children}
    </p>
  );
}

type Neighbour = { slug: string; locale: Locale; title: string };

/** The one before and the one after, under the text. */
export function ArticleNeighbours({
  base,
  locale,
  older,
  newer,
  label,
  prev,
  next,
}: {
  /** The list both live under — "/blog", "/secrets". */
  base: string;
  locale: Locale;
  older?: Neighbour | null;
  newer?: Neighbour | null;
  label: string;
  prev: string;
  next: string;
}) {
  if (!older && !newer) return null;
  // A neighbour may be a fallback too, and says so for its pronunciation.
  const langOf = (n: Neighbour) => (n.locale !== locale ? htmlLang(n.locale) : undefined);
  return (
    <nav aria-label={label} className="mt-20 grid gap-8 border-t border-line pt-8 sm:grid-cols-2">
      {older && (
        <Link href={`${base}/${older.slug}`} className="group flex flex-col gap-1.5">
          <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            ← {prev}
          </span>
          <span
            lang={langOf(older)}
            className="text-heading text-fg transition-colors duration-200 group-hover:text-accent"
          >
            {older.title}
          </span>
        </Link>
      )}
      {newer && (
        <Link
          href={`${base}/${newer.slug}`}
          className="group flex flex-col gap-1.5 sm:col-start-2 sm:items-end sm:text-right"
        >
          <span className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            {next} →
          </span>
          <span
            lang={langOf(newer)}
            className="text-heading text-fg transition-colors duration-200 group-hover:text-accent"
          >
            {newer.title}
          </span>
        </Link>
      )}
    </nav>
  );
}
