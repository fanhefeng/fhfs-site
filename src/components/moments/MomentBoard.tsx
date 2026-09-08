"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { site } from "@/config/site";
import { groupByYear } from "@/lib/byYear";
import { collections, FOLD_LINES, shouldFold, type BoardMoment } from "@/lib/moments";
import { Reveal } from "@/components/fx/Reveal";

/**
 * The board itself: a QQ 空间 of a list, kept to the magazine's paper. Every
 * line is in the DOM from the server, and that is the point — the page is
 * readable with no JavaScript at all, and a crawler sees all of it. What the
 * client adds is the notebook filter and the fold on the long ones, both of
 * which only ever hide what is already there.
 *
 * There used to be a "show 40 more" button here, and it broke that promise
 * quietly: the first render is a server render, so `shown` started at 40 and
 * the prerendered HTML carried forty of two hundred and forty-two lines. The
 * remaining two hundred existed only behind a click that needs JavaScript to
 * do anything. Two hundred short strings are not worth a paginator — the whole
 * board is a few tens of kilobytes, once, on a page whose entire subject is
 * that it is long.
 */
export function MomentBoard({ items }: { items: BoardMoment[] }) {
  const t = useTranslations("moments");
  const [notebook, setNotebook] = useState<string | null>(null);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const notebooks = useMemo(() => collections(items), [items]);
  const filtered = useMemo(
    () => (notebook ? items.filter((item) => item.collection === notebook) : items),
    [items, notebook]
  );
  const groups = groupByYear(filtered, (item) => item.year);

  const pick = (name: string | null) => setNotebook(name);
  const toggle = (key: string) =>
    setOpen((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  return (
    <>
      {notebooks.length > 1 && (
        <Reveal
          as="div"
          stagger={0.04}
          className="mb-14 flex flex-wrap items-center gap-2"
          // The filter is a set of radios in all but markup: one is pressed.
          // `aria-pressed` on buttons says so to a screen reader.
        >
          <Chip pressed={notebook === null} onClick={() => pick(null)} count={items.length}>
            {t("filterAll")}
          </Chip>
          {notebooks.map((nb) => (
            <Chip
              key={nb.name}
              pressed={notebook === nb.name}
              onClick={() => pick(nb.name)}
              count={nb.count}
            >
              「{nb.name}」
            </Chip>
          ))}
        </Reveal>
      )}

      {groups.map(({ year, items: yearItems }) => (
        <section key={year} aria-label={t("yearAria", { year })} className="mb-14 last:mb-0">
          <h2 className="mb-2 font-mono text-meta uppercase tracking-meta text-fg-tertiary tabular-nums">
            {year}
          </h2>
          <Reveal as="ol" stagger={0.05} className="border-t border-line">
            {yearItems.map((item) => (
              <MomentCard
                key={item.key}
                item={item}
                expanded={open.has(item.key)}
                onToggle={() => toggle(item.key)}
              />
            ))}
          </Reveal>
        </section>
      ))}

    </>
  );
}

function Chip({
  pressed,
  onClick,
  count,
  children,
}: {
  pressed: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`inline-flex min-h-9 items-center gap-2 rounded-chip border px-3.5 py-1.5 text-caption transition-colors ${
        pressed
          ? "border-fg bg-fg text-bg"
          : "border-line text-fg-secondary hover:border-accent hover:text-accent"
      }`}
    >
      <span>{children}</span>
      <span className={`font-mono text-meta tabular-nums ${pressed ? "text-bg/70" : "text-fg-tertiary"}`}>
        {count}
      </span>
    </button>
  );
}

/**
 * One line on the board. The header is the part that says QQ 空间 — a small
 * round avatar, the name, the hour — and it is deliberately quiet, so that
 * on a page of two hundred entries the words are what the eye lands on.
 */
function MomentCard({
  item,
  expanded,
  onToggle,
}: {
  item: BoardMoment;
  expanded: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations("moments");
  const folds = shouldFold(item.content);
  const clamped = folds && !expanded;

  return (
    <li className="border-b border-line py-6 last:border-b-0">
      <article>
        <header className="mb-3 flex items-center gap-3">
          <span
            aria-hidden="true"
            className="grid size-9 shrink-0 place-items-center rounded-full bg-fg font-mono text-[0.625rem] uppercase tracking-meta text-bg"
          >
            {site.signName}
          </span>
          <div className="min-w-0 flex-1 leading-tight">
            <p className="text-caption font-medium text-fg">
              {site.signName}
              {item.collection && (
                <span className="ml-2 font-normal text-fg-tertiary">「{item.collection}」</span>
              )}
            </p>
            <time dateTime={item.dateTime} className="font-mono text-meta text-fg-tertiary tabular-nums">
              {item.time}
            </time>
          </div>
          <span className="shrink-0 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            {item.original ? t("original") : t("quoted")}
          </span>
        </header>

        {/* The clamp counts the same lines `shouldFold` does — one number, or
            a card could carry a "read all" button with nothing hidden behind
            it. */}
        <p
          lang="zh-CN"
          style={clamped ? ({ "--fold-lines": FOLD_LINES } as CSSProperties) : undefined}
          className={`whitespace-pre-line text-body text-fg ${
            clamped ? "line-clamp-[var(--fold-lines)]" : ""
          }`}
        >
          {item.content}
        </p>

        {(item.attribution || folds) && (
          <footer className="mt-3 flex items-baseline justify-between gap-4">
            {item.attribution ? (
              <p className="text-caption text-fg-tertiary">—— {item.attribution}</p>
            ) : (
              <span />
            )}
            {folds && (
              <button
                type="button"
                onClick={onToggle}
                aria-expanded={expanded}
                className="hit-ext shrink-0 font-mono text-meta uppercase tracking-meta text-fg-secondary transition-colors hover:text-accent"
              >
                {expanded ? t("collapse") : t("expand")}
              </button>
            )}
          </footer>
        )}
      </article>
    </li>
  );
}
