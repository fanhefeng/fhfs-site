import { siteUrl } from "@/lib/siteUrl";

/**
 * Site-wide constants. Change `signName` to put your own name on the masthead.
 */
export const site = {
  /** The wordmark on the masthead / dynamic-island logo badge. Lowercase on
   *  purpose — the editorial identity sets the name quiet and small, and the
   *  changelog on /about numbers releases as `fhf 1.0 → 5.x`. */
  signName: "fhf",
  title: { zh: "fhf's", en: "fhf's" },
  description: {
    zh: "fhf 的个人网站：一个对世界好奇的前端 developer——文章、自研软件与动效实验，留一盏灯。",
    en: "The personal site of fhf — a front-end developer curious about the world: essays, self-built software and motion studies, with one light left on.",
  },
  /** Production origin, for canonical URLs, hreflang, the sitemap, RSS and
   *  the OG images. Read from the deployment (src/lib/siteUrl.ts), so binding
   *  a domain moves all of them with no edit here; only server code reads it
   *  — in the browser it is the fallback, which nothing there looks at. */
  url: siteUrl({
    // Named one by one: the bundler inlines a named variable, not the whole object.
    SITE_URL: process.env.SITE_URL,
    VERCEL_PROJECT_PRODUCTION_URL: process.env.VERCEL_PROJECT_PRODUCTION_URL,
  }),
  author: "fhf",
  /** Where the author is: the zone the footer clock keeps, and the one every
   *  page formats dates in — so a prerender on a UTC build machine prints the
   *  same day and month a render at home would. */
  timeZone: "Asia/Shanghai",
  /** This site's own repository — every lab study links its source there
   *  (`components/lab/entries.ts`, `sourceUrl`). */
  repo: "https://github.com/fanhefeng/fhfs-site",
  social: {
    github: "https://github.com/fanhefeng",
    /** Revealed under the tear-off sticker in the footer, listed on /resume
     *  and in the home page's contact row. */
    email: "fanhefeng901121@gmail.com",
  },
} as const;
