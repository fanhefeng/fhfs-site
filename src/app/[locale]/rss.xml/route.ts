import { Feed } from "feed";
import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
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

  // Fallback entries used to be skipped, on the reading that a feed is a claim
  // about what was published *in* this language. With every article written in
  // Chinese so far that emptied the English feed completely — nought items,
  // advertised from every English page by `feedTypes()` — while /en/blog listed
  // all six. A subscriber got silence from a site that was publishing.
  //
  // So they are listed, and said to be what they are: the title carries the
  // language, and the link and the id point at the edition that exists, which
  // is also the canonical the article page declares for a fallback render. The
  // shared id is what keeps a reader subscribed to both feeds from seeing the
  // same article twice.
  const t = await getTranslations({ locale: l, namespace: "blog" });
  for (const post of await getPosts(l)) {
    const url = `${site.url}/${post.locale}/blog/${post.slug}`;
    feed.addItem({
      title: post.isFallback
        ? `${post.title} ${t("feedFallbackTag")}`
        : post.title,
      id: url,
      link: url,
      description: post.summary,
      date: new Date(post.date),
    });
  }

  return new Response(feed.rss2(), {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
}
