import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { PostSummary } from "@/lib/content";
import { groupByYear, yearOfDate } from "@/lib/byYear";
import { Reveal } from "@/components/fx/Reveal";

/** The year-bucketed index — /blog and every tag page render this list. */
export function YearIndex({
  posts,
  yearAria,
}: {
  posts: PostSummary[];
  yearAria: (year: string) => string;
}) {
  return groupByYear(posts, yearOfDate).map(({ year, items: yearPosts }) => (
    <section key={year} aria-label={yearAria(year)} className="mb-14 last:mb-0">
      <h2 className="mb-3 font-mono text-meta uppercase tracking-meta text-fg-tertiary tabular-nums">
        {year}
      </h2>
      <Reveal as="ol" stagger={0.05} className="border-t border-line">
        {yearPosts.map((post) => (
          <PostCard key={post.slug} post={post} />
        ))}
      </Reveal>
    </section>
  ));
}

/**
 * One line of the magazine index: title on the left, mono date flush right.
 * No card, no summary, no thumbnail — the list is meant to be read like a
 * table of contents. Hovering (or keyboard-focusing) draws an amber underline
 * and floats the reading time in beside the date; both are transform/opacity
 * only, so a long list stays cheap to render.
 */
function PostCard({ post }: { post: PostSummary }) {
  const t = useTranslations("blog");
  const minutes = post.readingMinutes;
  const [, month, day] = post.date.split("-");

  return (
    <li className="border-b border-line last:border-b-0">
      <Link
        href={`/blog/${post.slug}`}
        className="group flex min-h-11 items-baseline gap-4 py-3.5 sm:gap-8"
      >
        <span className="relative flex-1 text-[1.3125rem] leading-snug font-medium tracking-[-0.01em] text-fg">
          {post.title}
          {/* Underline as a scaled hairline: transform-only, no reflow. */}
          <span
            aria-hidden
            className="absolute inset-x-0 -bottom-0.5 block h-px origin-left scale-x-0 bg-accent transition-transform duration-[250ms] ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100"
          />
        </span>
        <span className="flex shrink-0 items-baseline gap-3 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          <span className="hidden translate-x-1 opacity-0 transition duration-[250ms] ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 sm:inline-block">
            {t("readingTime", { minutes })}
          </span>
          <time dateTime={post.date} className="tabular-nums">
            {month}.{day}
          </time>
        </span>
      </Link>
    </li>
  );
}
