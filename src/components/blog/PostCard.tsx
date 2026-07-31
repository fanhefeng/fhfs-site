import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { readingMinutes, type LocalizedPost } from "@/lib/content";

/**
 * Posts bucketed by publication year, newest year first, each bucket keeping
 * the incoming (date-descending) order. The year comes from the ISO string
 * rather than a Date, so the grouping never drifts with the server timezone.
 */
export function groupPostsByYear(
  posts: LocalizedPost[]
): { year: string; posts: LocalizedPost[] }[] {
  const groups: { year: string; posts: LocalizedPost[] }[] = [];
  for (const post of posts) {
    const year = post.date.slice(0, 4);
    const last = groups.at(-1);
    if (last?.year === year) last.posts.push(post);
    else groups.push({ year, posts: [post] });
  }
  return groups;
}

/**
 * One line of the magazine index: title on the left, mono date flush right.
 * No card, no summary, no thumbnail — the list is meant to be read like a
 * table of contents. Hovering (or keyboard-focusing) draws an amber underline
 * and floats the reading time in beside the date; both are transform/opacity
 * only, so a long list stays cheap to render.
 */
export function PostCard({ post }: { post: LocalizedPost }) {
  const t = useTranslations("blog");
  const minutes = readingMinutes(post.content);
  const [, month, day] = post.date.slice(0, 10).split("-");

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
            className="absolute inset-x-0 -bottom-0.5 block h-px origin-left scale-x-0 bg-accent transition-transform duration-[250ms] ease-out group-hover:scale-x-100 group-focus-visible:scale-x-100 motion-reduce:transition-none"
          />
        </span>
        <span className="flex shrink-0 items-baseline gap-3 font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          <span className="hidden translate-x-1 opacity-0 transition duration-[250ms] ease-out group-hover:translate-x-0 group-hover:opacity-100 group-focus-visible:translate-x-0 group-focus-visible:opacity-100 motion-reduce:transition-none sm:inline-block">
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
