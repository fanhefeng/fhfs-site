/**
 * Site-wide constants. Change `signName` to put your own name on the masthead.
 */
export const site = {
  /** The wordmark on the masthead / dynamic-island logo badge. Lowercase on
   *  purpose — the editorial identity sets the name quiet and small, and the
   *  changelog on /about numbers releases as `fhf 1.0 → 5.x`. */
  signName: "fhf",
  title: { zh: "fhf — 安静的个人杂志", en: "fhf — The Quiet Issue" },
  description: {
    zh: "fhf 的个人网站：一个对世界好奇的前端 developer——文章、自研软件与动效实验，留一盏灯。",
    en: "The personal site of fhf — a front-end developer curious about the world: essays, self-built software and motion studies, with one light left on.",
  },
  /** Production origin, used for metadata/sitemap/RSS. Update after binding a domain. */
  url: "https://fhfs-site.vercel.app",
  author: "fhf",
  social: {
    github: "https://github.com/fanhefeng",
    /** Revealed under the tear-off sticker in the footer, listed on /resume
     *  and in the home page's contact row. */
    email: "fanhefeng901121@gmail.com",
  },
} as const;
