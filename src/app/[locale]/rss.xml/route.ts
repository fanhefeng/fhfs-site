import { Feed } from "feed";
import { routing, type Locale } from "@/i18n/routing";
import { site } from "@/config/site";
import { getPosts } from "@/lib/content";

export const dynamic = "force-static";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ locale: string }> }
) {
  const { locale } = await params;
  const l = (routing.locales as readonly string[]).includes(locale)
    ? (locale as Locale)
    : routing.defaultLocale;

  const feed = new Feed({
    title: site.title[l],
    description: site.description[l],
    id: `${site.url}/${l}`,
    link: `${site.url}/${l}`,
    language: l === "zh" ? "zh-CN" : "en",
    copyright: `© ${new Date().getFullYear()} ${site.author}`,
    author: { name: site.author },
  });

  for (const post of await getPosts(l)) {
    feed.addItem({
      title: post.title,
      id: `${site.url}/${l}/blog/${post.slug}`,
      link: `${site.url}/${l}/blog/${post.slug}`,
      description: post.summary,
      date: new Date(post.date),
    });
  }

  return new Response(feed.rss2(), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
