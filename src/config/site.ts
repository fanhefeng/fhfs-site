/**
 * Site-wide constants. Change `signName` to put your own name on the neon sign.
 */
export const site = {
  /** The name lit up on the neon sign, "Seb's" style. All caps: the marquee
   *  font only has capitals, so anything lowercase here would only show up
   *  in places that render the name in a normal typeface (the ASCII footer). */
  signName: "FHF'S",
  title: { zh: "FHF'S — 深夜小馆", en: "FHF'S — After Hours" },
  description: {
    zh: "个人博客、作品集与软件展示。深夜爵士与霓虹风格的个人网站。",
    en: "Personal blog, portfolio and software showcase, in a late-night jazz & neon mood.",
  },
  /** Production origin, used for metadata/sitemap/RSS. Update after binding a domain. */
  url: "https://fhfs-site.vercel.app",
  author: "FHF",
  social: {
    github: "https://github.com/fanhefeng",
  },
} as const;
