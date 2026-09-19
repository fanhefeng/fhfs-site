import { getTranslations } from "next-intl/server";
import { pageLocale } from "@/i18n/page";
import { Link } from "@/i18n/navigation";
import { sectionMetadata } from "@/lib/seo";
import { Reveal } from "@/components/fx/Reveal";
import { LAB_ENTRIES, LAB_GROUPS } from "@/components/lab/entries";
import type { CSSProperties } from "react";

export const generateMetadata = sectionMetadata("lab", "/lab", { count: LAB_ENTRIES.length });

/**
 * Lab index — one line per study, in the craft log's voice: name, one
 * sentence, no thumbnail. The demos themselves need a full viewport and
 * several screens of scroll distance, so each lives on its own route rather
 * than being squeezed into a 720px column here.
 *
 * Thirty-three lines is too many to read as one list, so they sit on the
 * three shelves the catalogue already keeps them on — built for the lab, in
 * use on the site, the shell — each under a heading and a sentence. The
 * ordinals run straight through: a shelf is a place to rest the eye, not a
 * renumbering.
 */
export default async function LabPage({ params }: PageProps<"/[locale]/lab">) {
  await pageLocale(params);
  const t = await getTranslations("lab");

  return (
    <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-24 pt-24">
      <header>
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {t("kicker")}
        </p>
        <h1 className="mt-3 text-display-sm text-fg">{t("title")}</h1>
        <p className="mt-4 text-body text-fg-secondary">
          {t("subtitle", { count: LAB_ENTRIES.length })}
        </p>
      </header>

      {LAB_GROUPS.map((group) => {
        const entries = LAB_ENTRIES.filter((entry) => entry.group === group);
        const first = entries[0];
        const last = entries[entries.length - 1];
        return (
          <section key={group} className="lab-group" aria-labelledby={`lab-group-${group}`}>
            <div className="lab-group-head">
              <h2
                id={`lab-group-${group}`}
                className="font-mono text-meta uppercase tracking-meta text-fg-tertiary"
              >
                {t(`groups.${group}.title`)}
              </h2>
              {first && last && (
                <span className="lab-group-range" aria-hidden="true">
                  {first.ordinal}–{last.ordinal}
                </span>
              )}
            </div>
            <p className="lab-group-lede">{t(`groups.${group}.lede`)}</p>

            <Reveal as="ul" className="lab-index" stagger={0.06} role="list">
              {entries.map((entry) => (
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
                        <span className="lab-name">{t(`items.${entry.key}.name`)}</span>
                        <span className="lab-tagline">{t(`items.${entry.key}.tagline`)}</span>
                      </span>
                      <span className="lab-desc">{t(`items.${entry.key}.summary`)}</span>
                    </span>
                    <span className="lab-arrow" aria-hidden="true">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </Reveal>
          </section>
        );
      })}

      <style href="lab-index" precedence="medium">
        {INDEX_CSS}
      </style>
    </main>
  );
}

const INDEX_CSS = `
.lab-group { margin-top: 3.5rem; }
.lab-group + .lab-group { margin-top: 4.5rem; }

.lab-group-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 1rem;
}
.lab-group-head h2 { margin: 0; }
.lab-group-range {
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  color: var(--fg-tertiary);
  font-variant-numeric: tabular-nums;
}
.lab-group-lede {
  margin: 0.6rem 0 0;
  max-width: 56ch;
  font-size: 0.9375rem;
  line-height: 1.65;
  color: var(--fg-secondary);
}

.lab-index { margin: 1.5rem 0 0; padding: 0; list-style: none; }

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

.lab-body { display: block; min-width: 0; }
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
/* Beside the name when it fits, on its own line when it does not, and
   wrapping there — never clipped. Some taglines run to three clauses, and on
   a phone even the short ones are wider than the column. */
.lab-tagline {
  min-width: 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-tertiary);
  overflow-wrap: anywhere;
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
