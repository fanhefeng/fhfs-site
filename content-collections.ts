import { defineCollection, defineConfig } from "@content-collections/core";
import { compileMDX, type Options } from "@content-collections/mdx";
import { z } from "zod";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";

const localeSchema = z.object({ zh: z.string(), en: z.string() });

const mdxOptions: Options = {
  rehypePlugins: [
    rehypeSlug,
    [rehypeAutolinkHeadings, { behavior: "wrap" }],
    [rehypePrettyCode, { theme: "tokyo-night", keepBackground: false }],
  ],
};

/** Parses "my-post.zh" style file names into { slug, locale }. */
function parseLocaleName(name: string) {
  const match = name.match(/^(.+)\.(zh|en)$/);
  if (!match) {
    throw new Error(
      `Content file "${name}" must end with a locale suffix (.zh or .en)`
    );
  }
  return { slug: match[1], locale: match[2] as "zh" | "en" };
}

const posts = defineCollection({
  name: "posts",
  directory: "content/blog",
  include: "**/*.mdx",
  schema: z.object({
    content: z.string(),
    title: z.string(),
    date: z.coerce.date(),
    tags: z.array(z.string()).default([]),
    summary: z.string(),
    draft: z.boolean().default(false),
    cover: z.string().optional(),
  }),
  transform: async (document, context) => {
    const mdx = await compileMDX(context, document, mdxOptions);
    const { slug, locale } = parseLocaleName(document._meta.fileName.replace(/\.mdx$/, ""));
    return {
      ...document,
      date: document.date.toISOString(),
      mdx,
      slug,
      locale,
    };
  },
});

const abouts = defineCollection({
  name: "abouts",
  directory: "content/about",
  include: "*.mdx",
  schema: z.object({
    content: z.string(),
    title: z.string(),
  }),
  transform: async (document, context) => {
    const mdx = await compileMDX(context, document, mdxOptions);
    const { locale } = parseLocaleName(document._meta.fileName.replace(/\.mdx$/, ""));
    return { ...document, mdx, locale };
  },
});

const works = defineCollection({
  name: "works",
  directory: "content/portfolio",
  include: "*.yaml",
  parser: "yaml",
  schema: z.object({
    title: localeSchema,
    description: localeSchema,
    year: z.number(),
    cover: z.string().optional(),
    url: z.string().optional(),
    tags: z.array(z.string()).default([]),
    order: z.number().default(0),
  }),
});

const apps = defineCollection({
  name: "apps",
  directory: "content/software",
  include: "*.yaml",
  parser: "yaml",
  schema: z.object({
    name: z.string(),
    tagline: localeSchema,
    description: localeSchema,
    category: z.enum(["desktop", "tool", "game", "website"]),
    icon: z.string().optional(),
    website: z.string(),
    platforms: z.array(z.string()).default([]),
    order: z.number().default(0),
  }),
});

const timeline = defineCollection({
  name: "timeline",
  directory: "content/about/timeline",
  include: "*.yaml",
  parser: "yaml",
  schema: z.object({
    period: z.string(),
    title: localeSchema,
    org: z.string().optional(),
    description: localeSchema,
    order: z.number(),
  }),
});

export default defineConfig({
  content: [posts, abouts, works, apps, timeline],
});
