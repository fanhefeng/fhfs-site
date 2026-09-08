import type { CSSProperties } from "react";
import Image from "next/image";
import { notFound } from "next/navigation";
import { hasLocale } from "next-intl";
import { setRequestLocale, getTranslations } from "next-intl/server";
import { routing } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { getAllNavItems, getMoments, getSecrets } from "@/lib/content";
import { sectionMetadata } from "@/lib/seo";
import { Reveal } from "@/components/fx/Reveal";
import { IDOLS } from "@/components/idols/entries";
import { ODYSSEY_STILLS } from "@/components/odyssey/stills";
import { ROOM_META } from "@/components/life/rooms";

export const generateMetadata = sectionMetadata("life", "/life");

type SubLink = { href: string; label: string };

/**
 * 生活 — the corridor the rooms open off. One line per room, in the order
 * of the nav table: its name, one sentence, and a mono line of what is in
 * it (how many, and which record goes on at the door). The rooms are read
 * off the table so a new one lists itself; the furniture comes from
 * `components/life/rooms`. No record of its own: a corridor is not a room.
 */
export default async function LifePage({ params }: PageProps<"/[locale]/life">) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  setRequestLocale(locale);
  const t = await getTranslations("life");
  const tNav = await getTranslations("nav");
  const tTracks = await getTranslations("tracks");
  const tIdols = await getTranslations("idols");

  const rooms = (await getAllNavItems()).filter(
    (row) => row.group === "rooms" && !row.surfaces.includes("header")
  );

  // What each room holds, counted where the room itself counts.
  const [moments, secrets] = await Promise.all([getMoments(), getSecrets(locale)]);
  const stat = (href: string): string | null => {
    switch (href) {
      case "/moments":
        return t("countEntries", { count: moments.length });
      case "/secrets":
        return secrets.length ? t("countPieces", { count: secrets.length }) : t("empty");
      case "/idols":
        return t("countIdols", { count: IDOLS.length });
      case "/odyssey":
        return t("countStills", { count: ODYSSEY_STILLS.length });
      default:
        return null;
    }
  };
  // The pages one level down that are worth a link on the row itself.
  const subs = (href: string): SubLink[] => {
    switch (href) {
      case "/idols":
        return IDOLS.map((idol) => ({ href: `/idols/${idol.slug}`, label: tIdols(`${idol.key}.name`) }));
      default:
        return [];
    }
  };

  return (
    <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-6 pb-28 pt-32 md:pt-40">
      <Reveal as="header" className="mb-12">
        <p className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">{t("kicker")}</p>
        <h1 className="mt-3 text-display-sm">{t("title")}</h1>
        <p className="mt-4 max-w-[46ch] text-body text-fg-secondary">{t("subtitle")}</p>
      </Reveal>

      {rooms.length === 0 ? (
        <p className="text-body text-fg-secondary">{t("none")}</p>
      ) : (
        <Reveal as="ol" role="list" stagger={0.06} className="border-t border-line">
          {rooms.map((room, i) => {
            const meta = ROOM_META[room.href];
            const key = meta?.key ?? room.labelKey;
            const title = t.has(`items.${key}.title`) ? t(`items.${key}.title`) : tNav(room.labelKey);
            const line = t.has(`items.${key}.line`) ? t(`items.${key}.line`) : null;
            const count = stat(room.href);
            const record = meta?.track ? t("record", { title: tTracks(`${meta.track}.title`) }) : null;
            const links = subs(room.href);
            return (
              <li
                key={room.href}
                className="life-row relative grid grid-cols-[auto_1fr] gap-x-4 border-b border-line py-6 sm:grid-cols-[auto_1fr_auto] sm:gap-x-6"
                style={{ "--row-accent": meta?.accent ?? "var(--accent)" } as CSSProperties}
              >
                <span className="pt-1 font-mono text-[0.6875rem] tracking-[0.08em] text-fg-tertiary" aria-hidden="true">
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div className="min-w-0">
                  <Link
                    href={room.href}
                    className="hit-ext text-heading text-fg transition-colors hover:text-accent"
                  >
                    {title}
                  </Link>
                  {line && <p className="mt-1.5 max-w-[52ch] text-caption text-fg-secondary">{line}</p>}
                  {(count || record) && (
                    <p className="mt-3 flex flex-wrap items-baseline gap-x-4 gap-y-1 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
                      {count && <span className="tabular-nums">{count}</span>}
                      {record && <span>{record}</span>}
                    </p>
                  )}
                  {links.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                      {links.map((link) => (
                        <li key={link.href}>
                          <Link
                            href={link.href}
                            className="hit-ext inline-flex min-h-9 items-center text-caption text-fg-secondary transition-colors hover:text-accent"
                          >
                            {link.label} →
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                {meta?.cover && (
                  <Link href={room.href} tabIndex={-1} aria-hidden="true" className="hidden sm:block">
                    <Image
                      src={meta.cover.src}
                      width={meta.cover.width}
                      height={meta.cover.height}
                      alt=""
                      sizes="96px"
                      className="size-24 rounded-card bg-surface object-cover object-top"
                    />
                  </Link>
                )}
              </li>
            );
          })}
        </Reveal>
      )}

      <style href="life-index" precedence="medium">
        {ROW_CSS}
      </style>
    </main>
  );
}

/** The same accent rule the lab index draws: it appears on the left on hover,
 *  and is the only motion a text row gets. */
const ROW_CSS = `
.life-row::before {
  content: "";
  position: absolute;
  left: -1rem;
  top: 1.5rem;
  bottom: 1.5rem;
  width: 2px;
  border-radius: 2px;
  background: var(--row-accent);
  opacity: 0;
  transition: opacity 0.25s ease-out;
}
.life-row:hover::before,
.life-row:focus-within::before { opacity: 0.75; }
`;
