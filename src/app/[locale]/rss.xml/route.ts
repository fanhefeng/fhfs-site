import { Feed } from "feed";
import { hasLocale } from "next-intl";
import { routing, htmlLang, type Locale } from "@/i18n/routing";
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
  const l: Locale = hasLocale(routing.locales, locale)
    ? locale
    : routing.defaultLocale;

  const self = `${site.url}/${l}/rss.xml`;
  const feed = new Feed({
    title: site.title[l],
    description: site.description[l],
    id: `${site.url}/${l}`,
    link: `${site.url}/${l}`,
    language: htmlLang(l),
    copyright: `© ${new Date().getFullYear()} ${site.author}`,
    author: { name: site.author },
    // Both spellings of the same thing: `feed` is what rss2() reads for the
    // `<atom:link rel="self">` validators ask for, `feedLinks` is the
    // documented field.
    feed: self,
    feedLinks: { rss: self },
  });

  for (const post of await getPosts(l)) {
    // The list falls back to the other language for a post this locale lacks;
    // a feed is a claim about what was published *in* this language, so those
    // stay out rather than appearing twice across the two feeds.
    if (post.isFallback) continue;
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
