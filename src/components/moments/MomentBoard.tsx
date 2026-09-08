"use client";

import { useMemo, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { site } from "@/config/site";
import { groupByYear } from "@/lib/byYear";
import { collections, FOLD_LINES, shouldFold, type BoardMoment } from "@/lib/moments";
import { Reveal } from "@/components/fx/Reveal";

/** How many lines come out per "more" — a screen or three, not the lot. */
const PAGE = 40;

/**
 * The board itself: a QQ 空间 of a list, kept to the magazine's paper. Every
 * line is in the DOM from the server (the page is read without JavaScript);
 * what the client adds is the notebook filter, the paging, and the fold on
 * the long ones. Filtering resets the paging — a filter is a new reading.
 */
export function MomentBoard({ items }: { items: BoardMoment[] }) {
  const t = useTranslations("moments");
  const [notebook, setNotebook] = useState<string | null>(null);
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const notebooks = useMemo(() => collections(items), [items]);
  const filtered = useMemo(
    () => (notebook ? items.filter((item) => item.collection === notebook) : items),
    [items, notebook]
  );
  const visible = filtered.slice(0, shown);
  const groups = groupByYear(visible, (item) => item.year);
  const remaining = filtered.length - visible.length;

  const pick = (name: string | null) => {
    setNotebook(name);
    setShown(PAGE);
  };
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

      {remaining > 0 && (
        <p className="mt-12 text-center">
          <button
            type="button"
            onClick={() => setShown((n) => n + PAGE)}
            className="hit-ext inline-flex min-h-11 items-center gap-2 rounded-chip border border-line px-4 py-2.5 text-caption text-fg transition-colors hover:border-accent hover:text-accent"
          >
            {t("more", { count: Math.min(remaining, PAGE) })}
            <span aria-hidden="true">↓</span>
          </button>
        </p>
      )}
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
