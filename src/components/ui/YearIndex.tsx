import type { ReactNode } from "react";
import { Link } from "@/i18n/navigation";
import { Reveal } from "@/components/fx/Reveal";

/**
 * The index the blog, the secrets and the board all read as: a year in mono
 * over a ruled list, one line per piece. These three used to carry their own
 * copies of this markup, and the copies had begun to disagree (the board's
 * year sat 4px closer to its list). The rows differ; the frame is this.
 */
export function YearSection({
  label,
  heading,
  children,
}: {
  /** Names the section for a screen reader — "Posts from 2024". */
  label: string;
  heading: ReactNode;
  children: ReactNode;
}) {
  return (
    <section aria-label={label} className="mb-14 last:mb-0">
      <h2 className="mb-3 font-mono text-meta uppercase tracking-meta text-fg-tertiary tabular-nums">
        {heading}
      </h2>
      <Reveal as="ol" stagger={0.05} className="border-t border-line">
        {children}
      </Reveal>
    </section>
  );
}

/**
 * One line of such an index: the title on the left, mono notes and the date
 * flush right. No card, no summary, no thumbnail — the list is meant to be
 * read like a table of contents. Hovering (or keyboard-focusing) draws an
 * amber underline and floats `detail` in beside the date; both are
 * transform/opacity only, so a long list stays cheap to render. The waiting
 * is only for a pointer that can hover — on a touch screen wide enough to
 * have the column, the detail is simply there (as in home/RecentWriting).
 */
export function IndexRow({
  href,
  title,
  titleLang,
  date,
  tag,
  detail,
}: {
  href: string;
  title: string;
  /** Set on a fallback row — the other language's title in this locale's
   *  list — or a screen reader pronounces 中文 with English rules. */
  titleLang?: string;
  /** `YYYY-MM-DD`; the row prints the month and day, the section the year. */
  date: string;
  /** Always shown, in the accent: what kind of piece this is. */
  tag?: ReactNode;
  /** Shown on hover: how long it takes. */
  detail?: ReactNode;
}) {
  const [, month, day] = date.split("-");
  return (
    <li className="border-b border-line last:border-b-0">
      <Link href={href} className="group flex min-h-11 items-baseline gap-4 py-3.5 sm:gap-8">
        <span
          lang={titleLang}
          className="relative flex-1 text-[1.3125rem] leading-snug font-medium tracking-[-0.01em] text-fg"
        >
          {title}
          {/* Underline as a scaled hairline: transform-only, no reflow. */}
          <span
            aria-hidden
            className="absolute inset-x-0 -bottom-0.5 block h-px origin-left scale-x-0 bg-accent transition-transform duration-[250ms] ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
          />
        </span>
        <span className="flex shrink-0 items-baseline gap-3 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          {tag && <span className="text-accent">{tag}</span>}
          {detail && (
            <span className="hidden transition duration-[250ms] ease-out sm:inline-block [@media(hover:hover)]:translate-x-1 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:translate-x-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-visible:translate-x-0 [@media(hover:hover)]:group-focus-visible:opacity-100">
              {detail}
            </span>
          )}
          <time dateTime={date} className="tabular-nums">
            {month}.{day}
          </time>
        </span>
      </Link>
    </li>
  );
}
