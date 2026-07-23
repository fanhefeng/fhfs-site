import { useFormatter } from "next-intl";
import { Link } from "@/i18n/navigation";
import type { LocalizedPost } from "@/lib/content";
import { TagPill } from "./TagPill";

export function PostCard({ post }: { post: LocalizedPost }) {
  const format = useFormatter();

  return (
    <article className="neon-card p-6">
      <Link href={`/blog/${post.slug}`} className="group block">
        <h2 className="font-deco text-xl tracking-wide text-fg transition-colors group-hover:text-neon-red">
          {post.title}
        </h2>
        <time
          dateTime={post.date}
          className="mt-1 block text-xs text-muted-fg"
        >
          {format.dateTime(new Date(post.date), {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </time>
        <p className="mt-3 text-sm leading-relaxed text-muted-fg">
          {post.summary}
        </p>
      </Link>
      {post.tags.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {post.tags.map((tag) => (
            <TagPill key={tag} tag={tag} />
          ))}
        </div>
      )}
    </article>
  );
}
