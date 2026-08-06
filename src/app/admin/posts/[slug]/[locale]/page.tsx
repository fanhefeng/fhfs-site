import { notFound } from "next/navigation";
import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { posts } from "@/db/schema";
import { AdminChrome } from "../../../AdminChrome";
import { PostForm } from "../../PostForm";

export default async function EditPost({
  params,
}: {
  params: Promise<{ slug: string; locale: string }>;
}) {
  const { slug, locale } = await params;
  if (locale !== "zh" && locale !== "en") notFound();

  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.slug, slug), eq(posts.locale, locale)))
    .limit(1);

  if (!post) notFound();

  return (
    <AdminChrome
      title={post.title}
      action={
        // A draft 404s on the site — no point linking to it.
        post.draft ? (
          <span className="text-caption text-fg-tertiary">草稿，未发布</span>
        ) : (
          <a
            href={`/${locale}/blog/${slug}`}
            target="_blank"
            rel="noreferrer"
            className="text-caption text-fg-tertiary hover:text-accent"
          >
            在站上看 ↗
          </a>
        )
      }
    >
      <PostForm
        isNew={false}
        post={{
          slug: post.slug,
          locale: post.locale,
          title: post.title,
          date: post.date,
          summary: post.summary,
          tags: post.tags,
          draft: post.draft,
          bodyMd: post.bodyMd,
        }}
      />
    </AdminChrome>
  );
}
