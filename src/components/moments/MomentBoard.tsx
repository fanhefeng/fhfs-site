"use client";

import { useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useTranslations } from "next-intl";
import { site } from "@/config/site";
import { groupByYear } from "@/lib/byYear";
import { collections, FOLD_LINES, shouldFold, type BoardMoment } from "@/lib/moments";
import { gsap, EASE } from "@/lib/gsap";
import { useUrlChoice } from "@/lib/useUrlChoice";
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
  const [open, setOpen] = useState<Set<string>>(() => new Set());

  const notebooks = useMemo(() => collections(items), [items]);
  // In the address bar (`?nb=…`): the chips sit at the top of two hundred
  // entries, and a reload or a shared link used to drop the reader back into
  // all of them.
  const [notebook, pick] = useUrlChoice(
    "nb",
    useMemo(() => notebooks.map((nb) => nb.name), [notebooks]),
  );
  const filtered = useMemo(
    () => (notebook ? items.filter((item) => item.collection === notebook) : items),
    [items, notebook],
  );
  // A pinned line stands above the years rather than in its own, so it is
  // read once, first — the way the old QQ 空间 held one at the top.
  const pinned = filtered.filter((item) => item.pinned);
  const groups = [
    ...(pinned.length > 0 ? [{ key: "pinned", heading: t("pinned"), items: pinned }] : []),
    ...groupByYear(
      filtered.filter((item) => !item.pinned),
      (item) => item.year,
    ).map(({ year, items }) => ({ key: year, heading: year, items })),
  ];

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
        // The filter is a set of radios in all but markup: one is pressed.
        // `aria-pressed` on the buttons says so to a screen reader, and the
        // group's name says what they are choosing between.
        <div role="group" aria-label={t("filterAria")}>
          <Reveal as="div" stagger={0.04} className="mb-14 flex flex-wrap items-center gap-2">
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
          {/* What a press did, for a reader who cannot see the list change. */}
          <p aria-live="polite" className="sr-only">
            {t("count", { count: filtered.length })}
          </p>
        </div>
      )}

      {groups.map(({ key, heading, items: yearItems }) => (
        <section
          key={key}
          aria-label={key === "pinned" ? t("pinnedAria") : t("yearAria", { year: heading })}
          className="mb-14 last:mb-0"
        >
          <h2 className="mb-2 font-mono text-meta uppercase tracking-meta text-fg-tertiary tabular-nums">
            {heading}
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
      <span
        className={`font-mono text-meta tabular-nums ${pressed ? "text-bg/70" : "text-fg-tertiary"}`}
      >
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

  const bodyRef = useRef<HTMLParagraphElement>(null);
  /** How tall the text stood when the button was pressed — where the fold
   *  starts from. Null on every render that a press did not cause. */
  const pressedAt = useRef<number | null>(null);

  const press = () => {
    pressedAt.current = bodyRef.current?.getBoundingClientRect().height ?? null;
    onToggle();
  };

  /**
   * The fold opens and closes instead of jumping: the rows below are pushed
   * down, or drawn up, over a third of a second, so the eye keeps its place
   * on a board of two hundred entries.
   *
   * The clamp itself cannot be tweened — it is on or off — so the height is,
   * measured either side of the render. Closing is the awkward direction: the
   * render has already put the clamp back, and a clamped box that is still
   * tall shows an ellipsis with text running on beneath it. So the clamp is
   * held off, inline, for as long as the box is closing, and handed back to
   * the class when it arrives. A second press mid-flight starts from wherever
   * the box had got to.
   */
  useLayoutEffect(() => {
    const el = bodyRef.current;
    const from = pressedAt.current;
    pressedAt.current = null;
    if (!el || from === null) return;
    const release = () => {
      el.style.removeProperty("height");
      el.style.removeProperty("overflow");
      el.style.removeProperty("-webkit-line-clamp");
    };
    // Whatever the last fold left inline is in the way of measuring this one.
    release();
    const to = el.getBoundingClientRect().height;
    if (Math.abs(to - from) < 1) return;
    if (to < from) el.style.setProperty("-webkit-line-clamp", "unset");
    el.style.overflow = "hidden";
    const tween = gsap.fromTo(
      el,
      { height: from },
      { height: to, duration: 0.35, ease: EASE.default, onComplete: release },
    );
    return () => {
      tween.kill();
    };
  }, [expanded]);

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
            <time
              dateTime={item.dateTime}
              className="font-mono text-meta text-fg-tertiary tabular-nums"
            >
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
          ref={bodyRef}
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
                onClick={press}
                aria-expanded={expanded}
                className="hit-ext inline-flex shrink-0 items-center gap-1.5 font-mono text-meta uppercase tracking-meta text-fg-secondary transition-colors hover:text-accent"
              >
                {expanded ? t("collapse") : t("expand")}
                {/* Which way the text will go — the words alone read as a
                    caption, and this is the one thing on the card that opens. */}
                <span
                  aria-hidden="true"
                  className={`transition-transform duration-300 ease-out ${expanded ? "rotate-180" : ""}`}
                >
                  ↓
                </span>
              </button>
            )}
          </footer>
        )}
      </article>
    </li>
  );
}
