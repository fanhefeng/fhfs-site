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
    zh: "fhf 的个人网站：一本安静的个人杂志兼私人画廊——收录文章、自研软件与动效实验。",
    en: "The personal site of fhf — a quiet magazine and private gallery of essays, self-built software, and motion experiments.",
  },
  /** Production origin, used for metadata/sitemap/RSS. Update after binding a domain. */
  url: "https://fhfs-site.vercel.app",
  author: "fhf",
  social: {
    github: "https://github.com/fanhefeng",
    /** Revealed under the tear-off sticker in the footer.
     *  TODO(user): fill in a real public address — left empty on purpose so
     *  the sticker can render a graceful fallback instead of a fake email. */
    email: "",
  },
} as const;
