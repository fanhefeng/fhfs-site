import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";

/**
 * Markdown → HTML, run once when a post is saved rather than on every render.
 *
 * This replaces the MDX bundle that content-collections used to compile. None
 * of the prose here ever used MDX's actual powers — no components, no imports,
 * no expressions — so the only thing MDX bought was an esbuild dependency that
 * does not travel well into a serverless function.
 *
 * The plugin list is carried over verbatim from the old `content-collections.ts`,
 * and that matters: `.prose-editorial` in globals.css styles the output by
 * element and by the attributes rehype-pretty-code emits. Every token still
 * ships `color: var(--shiki-light)` plus a `--shiki-dark` custom property, and
 * `code[data-theme*=" "]` still decides which one wins per theme. Change the
 * themes here and every stored post has to be re-rendered.
 *
 * `allowDangerousHtml` stays off: the source is Markdown, not HTML, and the
 * rendered string goes out through dangerouslySetInnerHTML.
 */
const pipeline = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeSlug)
  .use(rehypeAutolinkHeadings, { behavior: "wrap" })
  .use(rehypePrettyCode, {
    theme: { light: "github-light", dark: "tokyo-night" },
    keepBackground: false,
  })
  .use(rehypeStringify);

/** Async by necessity — shiki, inside rehype-pretty-code, is asynchronous. */
export async function renderMarkdown(source: string): Promise<string> {
  const file = await pipeline.process(source);
  return String(file);
}
