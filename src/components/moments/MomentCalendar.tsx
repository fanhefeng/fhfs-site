"use client";

import {
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type MouseEvent,
  type PointerEvent,
} from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import {
  dayCell,
  dayDate,
  dayLevel,
  monthColumns,
  yearGrid,
  type CalendarYear,
} from "@/lib/moments";

/** One square and the gap after it, in pixels — drawn 1:1, never scaled, so a
 *  square is a whole number of pixels and the pointer lands where it looks. */
const PITCH = 12;
const CELL = 10;
/** The weekday names on the left, and the month names above. */
const LEFT = 28;
const TOP = 18;
/** The rows the weekdays are named on: Monday, Wednesday, Friday. */
const NAMED_ROWS = [0, 2, 4] as const;
/** A year that starts on a Monday, for naming the rows. */
const MONDAY_YEAR = 2024;
/** How strongly each level of `dayLevel` is inked: the empty square in the
 *  page's own ink, the rest in the accent. */
const EMPTY = 0.08;
const SHADES = [0.32, 0.55, 0.78, 1] as const;

type Tip = { day: number; x: number; y: number };

/**
 * The calendar above the board, the way GitHub draws one: a year at a time, a
 * column a week and a square a day, Monday on top. The years are buttons
 * above it, newest first and picked first, as the board below starts there.
 *
 * Which square the pointer is on is worked out from where it is, not from
 * which element it touches: the gap between two squares belongs to the
 * nearer one, so the name above the pointer never flickers off between them,
 * and the ring and the tip are drawn from the same arithmetic as the square
 * itself. The tip is one element, moved, not a `<title>` a square — the
 * browser's own waits a second and appears beside the cursor, not over the day.
 *
 * Every day with a line is still a link to the newest of them on the board
 * (`#key`, the card's id), so a press works before any script has run. The
 * squares are out of the tab order and hidden from a screen reader, which
 * reads the board itself — the picture's name says what it shows.
 */
export function MomentCalendar({ years }: { years: CalendarYear[] }) {
  const t = useTranslations("moments");
  const format = useFormatter();
  const locale = useLocale();
  const [picked, setPicked] = useState(0);
  const [tip, setTip] = useState<Tip | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const tipRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<HTMLSpanElement>(null);

  const shown = years[picked] ?? years[0];
  const byDay = useMemo(() => new Map(shown?.days.map((cell) => [cell.day, cell])), [shown]);

  // On a phone the year is wider than the screen; start it at December, where
  // the newest of it is, as GitHub does. A desktop column holds all of it.
  useLayoutEffect(() => {
    const scroller = scrollerRef.current;
    if (scroller) scroller.scrollLeft = scroller.scrollWidth;
  }, [picked]);

  // Centre the tip over its square, but keep it on the screen: near either
  // edge it slides along, and its arrow stays on the square.
  useLayoutEffect(() => {
    const el = tipRef.current;
    const wrap = wrapRef.current;
    if (!tip || !el || !wrap) return;
    const offset = wrap.getBoundingClientRect().left;
    const room = document.documentElement.clientWidth;
    const width = el.offsetWidth;
    const left = Math.min(Math.max(tip.x - width / 2, 8 - offset), room - 8 - offset - width);
    el.style.left = `${left}px`;
    if (arrowRef.current) arrowRef.current.style.left = `${tip.x - left}px`;
  }, [tip]);

  if (!shown) return null;
  const { lead, days, columns } = yearGrid(shown.year);
  const width = LEFT + columns * PITCH - (PITCH - CELL);
  const height = TOP + 7 * PITCH - (PITCH - CELL);

  /** Put the tip on the day under the pointer, or take it away off the grid. */
  const point = (event: PointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const wrap = wrapRef.current?.getBoundingClientRect();
    // Pixels on the page per unit of the drawing: 1, unless something above
    // is scaled (the page transition scales `<main>`).
    const scale = box.width / width;
    const half = (PITCH - CELL) / 2;
    const column = Math.floor(((event.clientX - box.left) / scale - LEFT + half) / PITCH);
    const row = Math.floor(((event.clientY - box.top) / scale - TOP + half) / PITCH);
    const day = column * 7 + row - lead;
    if (!wrap || !scale || row < 0 || row > 6 || column < 0 || day < 0 || day >= days) {
      setTip(null);
    } else if (tip?.day !== day) {
      setTip({
        day,
        x: (box.left - wrap.left) / scale + LEFT + column * PITCH + CELL / 2,
        y: (box.top - wrap.top) / scale + TOP + row * PITCH,
      });
    }
  };

  /**
   * A press on a lit square: the address takes the line, and the board is told
   * to go to it (`MomentBoard`, which scrolls by Lenis). Left to the browser,
   * the jump to `#key` is undone by Lenis a frame later whenever the page is
   * still gliding from the wheel. A press that asks for a new tab or window
   * keeps the browser's own way.
   */
  const seek = (event: MouseEvent<Element>) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
      return;
    }
    event.preventDefault();
    window.history.pushState(null, "", event.currentTarget.getAttribute("href"));
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };

  const hovered = tip ? byDay.get(tip.day) : undefined;
  const place = (day: number) => {
    const { column, row } = dayCell(day, lead);
    return { x: LEFT + column * PITCH, y: TOP + row * PITCH };
  };
  const ring = tip ? place(tip.day) : null;

  return (
    <figure className="mb-14">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="font-mono text-meta text-fg-secondary tabular-nums">
          {t("calendarTotal", { year: String(shown.year), count: shown.total })}
        </p>
        <div role="group" aria-label={t("calendarYearsAria")} className="flex flex-wrap gap-1">
          {years.map((row, i) => (
            <button
              key={row.year}
              type="button"
              aria-pressed={row === shown}
              onClick={() => {
                setTip(null);
                setPicked(i);
              }}
              className={`min-h-8 rounded-chip px-2.5 font-mono text-meta tabular-nums transition-colors ${
                row === shown
                  ? "bg-fg text-bg"
                  : `hover:text-accent ${row.total === 0 ? "text-fg-tertiary/50" : "text-fg-tertiary"}`
              }`}
            >
              {row.year}
            </button>
          ))}
        </div>
      </div>

      <div ref={wrapRef} className="relative">
        <div ref={scrollerRef} onScroll={() => setTip(null)} className="overflow-x-auto">
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            role="img"
            aria-label={t("calendarAria", { year: String(shown.year) })}
            className="block text-fg"
            style={{ cursor: hovered ? "pointer" : undefined }}
            onPointerMove={point}
            onPointerDown={point}
            onPointerLeave={(event) => {
              // A finger lifts and leaves at once; let the tip it asked for stay.
              if (event.pointerType !== "touch") setTip(null);
            }}
          >
            <g aria-hidden="true" className="fill-fg-tertiary font-mono" fontSize={10}>
              {monthColumns(shown.year).map((column, month) => (
                <text key={month} x={LEFT + column * PITCH} y={10}>
                  {format.dateTime(Date.UTC(shown.year, month, 1), {
                    month: "short",
                    timeZone: "UTC",
                  })}
                </text>
              ))}
              {NAMED_ROWS.map((row) => (
                <text key={row} x={0} y={TOP + row * PITCH + CELL / 2} dominantBaseline="central">
                  {format.dateTime(dayDate(MONDAY_YEAR, row), {
                    weekday: locale === "zh" ? "narrow" : "short",
                    timeZone: "UTC",
                  })}
                </text>
              ))}
            </g>
            <g aria-hidden="true">
              {Array.from({ length: days }, (_, day) => {
                const { x, y } = place(day);
                const cell = byDay.get(day);
                const square = (
                  <rect
                    key={day}
                    x={x}
                    y={y}
                    width={CELL}
                    height={CELL}
                    rx={2}
                    className={cell ? "fill-accent" : undefined}
                    fill={cell ? undefined : "currentColor"}
                    fillOpacity={cell ? SHADES[dayLevel(cell.count) - 1] : EMPTY}
                  />
                );
                return cell ? (
                  <a key={day} href={`#${cell.newest}`} tabIndex={-1} onClick={seek}>
                    {/* The link reaches half across the gap on every side —
                        the same square the pointer arithmetic gives the day,
                        so a press lands wherever the ring is drawn. */}
                    <rect
                      x={x - (PITCH - CELL) / 2}
                      y={y - (PITCH - CELL) / 2}
                      width={PITCH}
                      height={PITCH}
                      fill="transparent"
                    />
                    {square}
                  </a>
                ) : (
                  square
                );
              })}
            </g>
            {ring && (
              <rect
                x={ring.x - 1}
                y={ring.y - 1}
                width={CELL + 2}
                height={CELL + 2}
                rx={3}
                fill="none"
                stroke="currentColor"
                strokeWidth={1}
                pointerEvents="none"
              />
            )}
          </svg>
        </div>

        {tip && (
          <div
            ref={tipRef}
            aria-hidden="true"
            className="pointer-events-none absolute z-10 -translate-y-full whitespace-nowrap rounded-chip bg-fg px-2.5 py-1 font-mono text-meta text-bg tabular-nums"
            style={{ left: tip.x, top: tip.y - 8 }}
          >
            {t("calendarDay", {
              date: format.dateTime(dayDate(shown.year, tip.day), {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "short",
                timeZone: "UTC",
              }),
              count: hovered?.count ?? 0,
            })}
            <span
              ref={arrowRef}
              className="absolute top-full size-0 -translate-x-1/2 border-x-[5px] border-t-[5px] border-x-transparent border-t-fg"
            />
          </div>
        )}
      </div>

      <figcaption className="mt-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-2 font-mono text-meta text-fg-tertiary">
        <span>{t("calendarHint")}</span>
        <span aria-hidden="true" className="flex items-center gap-1.5">
          {t("calendarLess")}
          <svg
            width={5 * PITCH - (PITCH - CELL)}
            height={CELL}
            viewBox={`0 0 ${5 * PITCH - (PITCH - CELL)} ${CELL}`}
            className="block text-fg"
          >
            {[EMPTY, ...SHADES].map((shade, level) => (
              <rect
                key={level}
                x={level * PITCH}
                width={CELL}
                height={CELL}
                rx={2}
                className={level > 0 ? "fill-accent" : undefined}
                fill={level > 0 ? undefined : "currentColor"}
                fillOpacity={shade}
              />
            ))}
          </svg>
          {t("calendarMore")}
        </span>
      </figcaption>
    </figure>
  );
}
