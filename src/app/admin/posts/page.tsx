import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { AdminChrome } from "../AdminChrome";

export default async function PostsIndex() {
  const rows = await db
    .select({
      slug: posts.slug,
      locale: posts.locale,
      title: posts.title,
      date: posts.date,
      draft: posts.draft,
      readingMinutes: posts.readingMinutes,
    })
    .from(posts)
    .orderBy(desc(posts.date), asc(posts.locale));

  return (
    <AdminChrome
      title="文章"
      action={
        <Link
          href="/admin/posts/new"
          className="min-h-11 rounded-card border border-line px-4 py-2.5 text-caption hover:border-accent hover:text-accent"
        >
          写新的
        </Link>
      }
    >
      <ul className="divide-y divide-line border-y border-line">
        {rows.map((post) => (
          <li key={`${post.slug}.${post.locale}`}>
            <Link
              href={`/admin/posts/${post.slug}/${post.locale}`}
              className="flex min-h-11 flex-wrap items-baseline gap-x-4 gap-y-1 py-3 hover:text-accent"
            >
              <span className="font-mono text-meta text-fg-tertiary tabular-nums">
                {post.date}
              </span>
              <span className="font-mono text-meta uppercase text-fg-tertiary">
                {post.locale}
              </span>
              <span className="flex-1 text-body">{post.title}</span>
              {post.draft && (
                <span className="font-mono text-meta uppercase tracking-meta text-accent">
                  草稿
                </span>
              )}
              <span className="font-mono text-meta text-fg-tertiary tabular-nums">
                {post.readingMinutes}m
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AdminChrome>
  );
}
