import { hasLocale } from "next-intl";
import { getTranslations } from "next-intl/server";
import { routing, type Locale } from "@/i18n/routing";
import { site } from "@/config/site";
import {
  getAllNavItems,
  getApps,
  getFilms,
  getIdols,
  getMoments,
  getPosts,
  getSecrets,
} from "@/lib/server/content";
import { inLocale } from "@/lib/localized";
import { stampInZone } from "@/lib/moments";
import type { SearchEntry } from "@/lib/search";
import { LAB_ENTRIES } from "@/components/lab/entries";

export const dynamic = "force-static";
// Two indexes and nothing else — the same reason as the feed beside it.
export const dynamicParams = false;

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/**
 * The search palette's index for one language: every page, article, secret,
 * app, lab study, film, idol and moment, as a title, some text to match and
 * an address. Built once and cached like the feed — the getters' tags reach
 * it, so a save in the admin rebuilds it with the pages. Fetched only when
 * the palette first opens; no page carries it.
 *
 * Moments go in whole: five hundred short lines are about seventy kilobytes,
 * half that on the wire, and a search that missed an old line would be the
 * one thing the board cannot do already.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const l: Locale = hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
  const [tn, tl, ts] = await Promise.all([
    getTranslations({ locale: l, namespace: "nav" }),
    getTranslations({ locale: l, namespace: "lab" }),
    getTranslations({ locale: l, namespace: "software" }),
  ]);
  const [nav, posts, secrets, apps, films, idols, moments] = await Promise.all([
    getAllNavItems(),
    getPosts(l),
    getSecrets(l),
    getApps(),
    getFilms(),
    getIdols(),
    getMoments(),
  ]);

  const entries: SearchEntry[] = [
    ...nav.map((row) => ({
      kind: "page" as const,
      title: tn(row.labelKey),
      text: "",
      href: row.href,
    })),
    ...posts.map((post) => ({
      kind: "post" as const,
      title: post.title,
      text: [post.summary, ...post.tags].join(" "),
      href: `/blog/${post.slug}`,
      meta: post.date,
    })),
    ...secrets.map((secret) => ({
      kind: "secret" as const,
      title: secret.title,
      text: secret.summary,
      href: `/secrets/${secret.slug}`,
      meta: secret.date,
    })),
    ...apps.map((app) => ({
      kind: "app" as const,
      title: app.name,
      text: `${app.tagline[l]} ${app.description[l]}`,
      href: "/software",
      meta: ts(`categories.${app.category}`),
    })),
    ...LAB_ENTRIES.map((entry) => ({
      kind: "lab" as const,
      title: tl(`items.${entry.key}.name`),
      text: `${tl(`items.${entry.key}.tagline`)} ${tl(`items.${entry.key}.summary`)}`,
      href: `/lab/${entry.slug}`,
    })),
    ...films
      .map((row) => inLocale(row, l))
      .map((film) => ({
        kind: "film" as const,
        title: film.title,
        text: `${film.latin} ${film.meta} ${film.lede}`,
        href: `/films/${film.key}`,
        meta: film.year,
      })),
    ...idols
      .map((row) => inLocale(row, l))
      .map((idol) => ({
        kind: "idol" as const,
        title: idol.name,
        text: `${idol.latin} ${idol.lede}`,
        href: `/idols/${idol.key}`,
        meta: idol.years,
      })),
    ...moments
      .filter((moment) => moment.content)
      .map((moment) => ({
        kind: "moment" as const,
        title: "",
        text: moment.content,
        href: `/moments#${moment.key}`,
        meta: stampInZone(moment.postedAt, site.timeZone).time.slice(0, 10),
      })),
  ];

  return Response.json(entries);
}
