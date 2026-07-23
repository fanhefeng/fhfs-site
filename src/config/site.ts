/**
 * Site-wide constants. Change `signName` to put your own name on the neon sign.
 */
export const site = {
  /** The name lit up on the neon sign, e.g. "Seb's" style. */
  signName: "Fhf's",
  title: { zh: "Fhf's — 深夜小馆", en: "Fhf's — After Hours" },
  description: {
    zh: "个人博客、作品集与软件展示。深夜爵士与霓虹风格的个人网站。",
    en: "Personal blog, portfolio and software showcase, in a late-night jazz & neon mood.",
  },
  /** Production origin, used for metadata/sitemap/RSS. Update after binding a domain. */
  url: "https://fhfs-site.vercel.app",
  author: "Fhf",
  social: {
    github: "https://github.com/fanhefeng",
  },
} as const;
