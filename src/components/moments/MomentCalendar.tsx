import { getTranslations } from "next-intl/server";
import { weeksInYear, type CalendarYear } from "@/lib/moments";

/** One square and the gap after it, in SVG units. */
const PITCH = 12;
const CELL = 10;
/** The year's label on the left, and the month ticks above. */
const LABEL = 38;
const TOP = 16;
/** The widest a row can get: 54 columns (see `weeksInYear`). */
const COLUMNS = 54;

/** Where January, April, July and October start, in weeks of a common year. */
const MONTHS = [
  ["01", 0],
  ["04", 90 / 7],
  ["07", 181 / 7],
  ["10", 273 / 7],
] as const;

/** How dark a week is drawn: the bands a sparse board and a busy one both read in. */
const shade = (count: number) => (count >= 7 ? 1 : count >= 4 ? 0.75 : count >= 2 ? 0.5 : 0.3);

/**
 * The years above the board, a row each and a square a week — how much was
 * said when, at a glance, before the list says what. Drawn here on the
 * server as one SVG: no script, nothing added to the page's budget.
 *
 * Every week that holds a line is a link to the newest of them on the board
 * below (`#key`, the card's id). The empty weeks are one patterned rect a
 * row, not five hundred. The squares are out of the tab order and hidden from
 * a screen reader, which reads the board itself — the picture's name says
 * what it shows; the lines are all below it.
 */
export async function MomentCalendar({ years }: { years: CalendarYear[] }) {
  const t = await getTranslations("moments");
  if (years.length === 0) return null;
  const span = years.length;
  const height = TOP + span * PITCH;
  const width = LABEL + COLUMNS * PITCH;

  return (
    <figure className="mb-14">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={t("calendarAria", { years: span })}
        className="block h-auto w-full text-fg"
      >
        <defs>
          <pattern id="moment-week" width={PITCH} height={PITCH} patternUnits="userSpaceOnUse">
            <rect width={CELL} height={CELL} rx={2} fill="currentColor" fillOpacity={0.07} />
          </pattern>
        </defs>
        <g aria-hidden="true" className="fill-fg-tertiary font-mono" fontSize={9}>
          {MONTHS.map(([label, week]) => (
            <text key={label} x={LABEL + week * PITCH} y={9}>
              {label}
            </text>
          ))}
        </g>
        {years.map((row, i) => {
          const y = TOP + i * PITCH;
          return (
            <g key={row.year} aria-hidden="true">
              <text
                x={0}
                y={y + CELL - 1}
                fontSize={9}
                className="fill-fg-tertiary font-mono tabular-nums"
              >
                {row.year}
              </text>
              <rect
                x={LABEL}
                y={y}
                width={weeksInYear(Number(row.year)) * PITCH}
                height={PITCH}
                fill="url(#moment-week)"
              />
              {row.weeks.map((week) => (
                <a key={week.week} href={`#${week.newest}`} tabIndex={-1}>
                  <title>{t("calendarWeek", { start: week.start, count: week.count })}</title>
                  <rect
                    x={LABEL + week.week * PITCH}
                    y={y}
                    width={CELL}
                    height={CELL}
                    rx={2}
                    className="fill-accent transition-opacity hover:opacity-60"
                    fillOpacity={shade(week.count)}
                  />
                </a>
              ))}
            </g>
          );
        })}
      </svg>
      <figcaption className="mt-3 font-mono text-meta text-fg-tertiary">
        {t("calendarCaption", { years: span })}
      </figcaption>
    </figure>
  );
}
