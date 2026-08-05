"use client";

import { useTranslations } from "next-intl";
import type { CSSProperties } from "react";
import { Reveal } from "@/components/fx/Reveal";
import { LiquidLens } from "@/components/portfolio/LiquidLens";

export type CraftStatus = "live" | "wip" | "planned";

export type CraftEntry = {
  id: string;
  /** Already resolved to this page's language. */
  name: string;
  description: string;
  status: CraftStatus;
  /** Dot + hover rule colour. */
  accent: string;
  /** External write-up or source demo, when there is one. */
  href?: string;
  /** Entries that carry an inline demo below the line. */
  demo?: "liquid-lens";
};

type Props = {
  entries: CraftEntry[];
  title: string;
  subtitle: string;
  /** Same-origin href used by the lens demo's still-clickable link. */
  lensLinkHref: string;
};

/**
 * Craft list (rauno.me's "Craft" page, in this site's voice): one line per
 * experiment — name, one sentence, status. No cards, no thumbnails; the
 * list is text, and only the entry that *is* a live experiment renders one.
 *
 * Name, sentence, status, colour and links all arrive together as one record.
 * They used to be split — a constant here, two message keys per language over
 * there, joined by an id nothing checked — so adding an experiment meant
 * editing three files and finding out later if you missed one.
 */
export function CraftList({ entries, title, subtitle, lensLinkHref }: Props) {
  const t = useTranslations("portfolio");

  return (
    <section className="craft-section">
      <style href="craft-list" precedence="medium">{CRAFT_CSS}</style>

      <h2 className="text-title">{title}</h2>
      <p className="craft-sub">{subtitle}</p>

      <Reveal as="ul" className="craft-list" stagger={0.06}>
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="craft-row"
            style={{ "--row-accent": entry.accent } as CSSProperties}
          >
            <div className="craft-line">
              <h3 className="craft-name">{entry.name}</h3>
              <span className={`craft-status craft-status--${entry.status}`}>
                <span className="craft-dot" aria-hidden="true" />
                {t(`status.${entry.status}`)}
              </span>
            </div>
            <p className="craft-desc">{entry.description}</p>
            {entry.href && (
              <a
                className="craft-link hit-ext"
                href={entry.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {t("openDemo")}
                <span aria-hidden="true"> ↗</span>
              </a>
            )}
            {entry.demo === "liquid-lens" && (
              <LiquidLens
                heading={t("lens.heading")}
                body={t("lens.body")}
                hint={t("lens.hint")}
                fallbackNote={t("lens.fallback")}
                linkLabel={t("lens.link")}
                linkHref={lensLinkHref}
                accent={entry.accent}
              />
            )}
          </li>
        ))}
      </Reveal>
    </section>
  );
}

const CRAFT_CSS = `
.craft-section { margin-top: 1rem; }
.craft-sub {
  margin-top: 0.5rem;
  font-size: 1.0625rem;
  line-height: 1.7;
  color: var(--fg-secondary);
}

.craft-list { margin: 2.25rem 0 0; padding: 0; list-style: none; }

.craft-row {
  position: relative;
  padding: 1.15rem 0 1.15rem 1rem;
  border-top: 1px solid var(--line);
}
.craft-row:last-child { border-bottom: 1px solid var(--line); }
/* The accent rule slides in from the left edge on hover — the only motion
   a text row needs. */
.craft-row::before {
  content: "";
  position: absolute;
  left: 0;
  top: 1.15rem;
  bottom: 1.15rem;
  width: 2px;
  border-radius: 2px;
  background: var(--row-accent);
  opacity: 0;
  transition: opacity 0.25s ease-out;
}
.craft-row:hover::before,
.craft-row:focus-within::before { opacity: 0.75; }

.craft-line {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 0.5rem 1rem;
}
.craft-name {
  margin: 0;
  font-size: 1.0625rem;
  font-weight: 600;
  letter-spacing: -0.01em;
}

.craft-status {
  display: inline-flex;
  align-items: center;
  gap: 0.4rem;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-tertiary);
  white-space: nowrap;
}
.craft-dot {
  width: 0.4rem;
  height: 0.4rem;
  border-radius: 50%;
  background: currentColor;
}
.craft-status--live { color: color-mix(in srgb, var(--fg) 45%, #4c7a5b); }
.craft-status--wip { color: var(--accent); }

.craft-desc {
  margin: 0.4rem 0 0;
  max-width: 60ch;
  font-size: 0.9375rem;
  line-height: 1.65;
  color: var(--fg-secondary);
}

.craft-link {
  display: inline-block;
  margin-top: 0.5rem;
  /* Padding + .hit-ext keep the tap target past 44px without a big label. */
  padding: 0.4rem 0;
  font-family: var(--font-stack-mono);
  font-size: 0.6875rem;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--fg-secondary);
  text-decoration: underline;
  text-decoration-color: color-mix(in srgb, var(--accent) 55%, transparent);
  text-underline-offset: 4px;
  transition: color 0.2s ease-out;
}
.craft-link:hover { color: var(--accent); }
`;
