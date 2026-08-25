import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { sectionMetadata } from "@/lib/seo";
import { Reveal } from "@/components/fx/Reveal";
import { LAB_ENTRIES } from "@/components/lab/entries";
import type { CSSProperties } from "react";

export const generateMetadata = sectionMetadata("lab", "/lab");

/**
 * Lab index — one line per study, in the craft log's voice: name, one
 * sentence, no thumbnail. The demos themselves need a full viewport and
 * several screens of scroll distance, so each lives on its own route rather
 * than being squeezed into a 680px column here.
 */
export default async function LabPage({ params }: PageProps<"/[locale]/lab">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("lab");

  return (
    <main id="main" className="mx-auto w-full max-w-[680px] flex-1 px-6 pb-24 pt-24">
      <header>
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t("kicker")}
        </p>
        <h1 className="mt-3 text-display-sm text-fg">{t("title")}</h1>
        <p className="mt-4 text-body text-fg-secondary">{t("subtitle")}</p>
      </header>

      <Reveal as="ul" className="lab-index" stagger={0.06}>
        {LAB_ENTRIES.map((entry) => (
          <li
            key={entry.slug}
            className="lab-row"
            style={{ "--row-accent": entry.accent } as CSSProperties}
          >
            <Link href={`/lab/${entry.slug}`} className="lab-link">
              <span className="lab-ordinal" aria-hidden="true">
                {entry.ordinal}
              </span>
              <span className="lab-body">
                <span className="lab-line">
                  <span className="lab-name">
                    {t(`items.${entry.key}.name`)}
                  </span>
                  <span className="lab-tagline">
                    {t(`items.${entry.key}.tagline`)}
                  </span>
                </span>
                <span className="lab-desc">
                  {t(`items.${entry.key}.summary`)}
                </span>
              </span>
              <span className="lab-arrow" aria-hidden="true">
                →
              </span>
            </Link>
          </li>
        ))}
      </Reveal>

      <style href="lab-index" precedence="medium">
        {INDEX_CSS}
      </style>
    </main>
  );
}

const INDEX_CSS = `
.lab-index { margin: 2.75rem 0 0; padding: 0; list-style: none; }

.lab-row { position: relative; border-top: 1px solid var(--line); }
.lab-row:last-child { border-bottom: 1px solid var(--line); }
/* Same accent rule as the craft log: it slides in from the left on hover and
   is the only motion a text row gets. */
.lab-row::before {
  content: "";
  position: absolute;
  left: 0;
  top: 1.35rem;
  bottom: 1.35rem;
  width: 2px;
  border-radius: 2px;
  background: var(--row-accent);
  opacity: 0;
  transition: opacity 0.25s ease-out;
}
.lab-row:hover::before,
.lab-row:focus-within::before { opacity: 0.75; }

.lab-link {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: baseline;
  gap: 0 1rem;
  padding: 1.35rem 0 1.35rem 1rem;
  color: inherit;
  text-decoration: none;
}

.lab-ordinal {
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  color: var(--fg-tertiary);
}

.lab-body { display: block; }
.lab-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.35rem 0.75rem;
}
.lab-name {
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}
.lab-tagline {
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-tertiary);
  white-space: nowrap;
}
.lab-desc {
  display: block;
  margin-top: 0.4rem;
  max-width: 56ch;
  font-size: 0.9375rem;
  line-height: 1.65;
  color: var(--fg-secondary);
}

.lab-arrow {
  align-self: center;
  color: var(--fg-tertiary);
  transition: transform 0.25s ease-out, color 0.25s ease-out;
}
.lab-link:hover .lab-arrow,
.lab-link:focus-visible .lab-arrow {
  transform: translateX(3px);
  color: var(--accent);
}
`;
