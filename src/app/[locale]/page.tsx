import type { Metadata } from "next";
import { setRequestLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@/i18n/routing";
import { localeAlternates } from "@/lib/seo";
import { JsonLd } from "@/components/seo/JsonLd";
import { Link } from "@/i18n/navigation";
import { site } from "@/config/site";
import { getPosts, getApps } from "@/lib/content";
import { PostCard } from "@/components/blog/PostCard";
import { AppCard } from "@/components/cards/AppCard";
import { ArtDecoDivider } from "@/components/deco/ArtDecoDivider";
import { NeonSign } from "@/components/fx/NeonSign";
import { SpotlightReveal } from "@/components/fx/SpotlightReveal";
import { MarqueeLights } from "@/components/fx/MarqueeLights";

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  return { alternates: localeAlternates("", locale) };
}

export default async function HomePage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations("home");
  const tc = await getTranslations("common");
  const posts = getPosts(locale as Locale).slice(0, 3);
  const apps = getApps().slice(0, 4);

  return (
    <main className="flex-1">
      <JsonLd
        data={{
          "@context": "https://schema.org",
          "@type": "Person",
          name: site.author,
          url: site.url,
          sameAs: [site.social.github],
        }}
      />
      {/* Hero — the neon sign stage */}
      <NeonSign
        welcome={t("welcome")}
        name={site.signName}
        tagline={t("tagline")}
        skipLabel={tc("skipAnimation")}
      >
        <MarqueeLights className="neon-rest" />
        <p className="neon-rest max-w-md text-sm leading-relaxed text-muted-fg">
          {t("intro")}
        </p>
        <Link
          href="/blog"
          className="neon-rest mt-4 rounded border border-neon-red/50 px-6 py-2.5 text-sm text-neon-red transition-all duration-200 hover:border-neon-red hover:[box-shadow:0_0_16px_rgba(255,77,109,0.35)] hover:[text-shadow:var(--glow-red)]"
        >
          {t("enter")}
        </Link>
      </NeonSign>

      {/* Latest posts */}
      <SpotlightReveal>
      <section className="mx-auto max-w-3xl px-6 py-16">
        <h2 className="mb-2 text-center font-deco text-2xl tracking-widest text-gold">
          {t("latestPosts")}
        </h2>
        <ArtDecoDivider className="mb-10" />
        <div className="flex flex-col gap-6">
          {posts.map((post) => (
            <PostCard key={post.slug} post={post} />
          ))}
        </div>
        <p className="mt-8 text-center">
          <Link
            href="/blog"
            className="text-sm text-neon-blue transition-all hover:[text-shadow:var(--glow-blue)]"
          >
            {t("viewAll")} →
          </Link>
        </p>
      </section>
      </SpotlightReveal>

      {/* Featured works */}
      <SpotlightReveal>
      <section className="mx-auto max-w-5xl px-6 py-16">
        <h2 className="mb-2 text-center font-deco text-2xl tracking-widest text-gold">
          {t("featuredWorks")}
        </h2>
        <ArtDecoDivider className="mb-10" />
        <div className="grid gap-6 sm:grid-cols-2">
          {apps.map((app) => (
            <AppCard key={app._meta.path} app={app} locale={locale as Locale} />
          ))}
        </div>
        <p className="mt-8 text-center">
          <Link
            href="/software"
            className="text-sm text-neon-blue transition-all hover:[text-shadow:var(--glow-blue)]"
          >
            {t("viewAll")} →
          </Link>
        </p>
      </section>
      </SpotlightReveal>
    </main>
  );
}
