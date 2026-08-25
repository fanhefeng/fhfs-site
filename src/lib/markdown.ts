import { unified } from "unified";
import remarkParse from "remark-parse";
import remarkGfm from "remark-gfm";
import remarkRehype from "remark-rehype";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import rehypePrettyCode from "rehype-pretty-code";
import rehypeStringify from "rehype-stringify";

/** The slice of a hast node this file looks at — enough to walk it and read
 *  its attributes, without reaching for a types package for two fields. */
type HastNode = {
  type: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

const URL_ATTRIBUTES = ["href", "src"] as const;
const SAFE_PROTOCOLS = new Set(["http:", "https:", "mailto:", "tel:"]);
/** What a browser reads as a scheme: letters, then digits/`+.-`, then `:`. */
const SCHEME = /^([a-z][a-z0-9+.-]*):/;

/**
 * Relative paths, anchors and the four protocols above pass; anything else
 * with a scheme — `javascript:`, `data:`, `vbscript:` — does not. Browsers
 * skip ASCII whitespace and control characters when reading a scheme, so
 * `java\nscript:` runs; they are stripped before looking, not just trimmed.
 */
function isSafeUrl(value: string): boolean {
  const url = Array.from(value)
    .filter((ch) => ch.charCodeAt(0) > 0x20)
    .join("")
    .toLowerCase();
  const scheme = SCHEME.exec(url);
  return !scheme || SAFE_PROTOCOLS.has(`${scheme[1]}:`);
}

/**
 * Drops `href`/`src` attributes that carry a dangerous protocol.
 *
 * remark-rehype percent-encodes link targets but does not police their
 * scheme, and the output goes into the page unescaped. The author is the
 * only one who writes here — this is a belt for the day that is not true.
 */
function rehypeSafeUrls() {
  return (tree: HastNode) => {
    const walk = (node: HastNode) => {
      if (node.type === "element" && node.properties) {
        for (const name of URL_ATTRIBUTES) {
          const value = node.properties[name];
          if (value == null || value === false) continue;
          if (typeof value !== "string" || !isSafeUrl(value)) {
            delete node.properties[name];
          }
        }
      }
      node.children?.forEach(walk);
    };
    walk(tree);
  };
}

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
  .use(rehypeSafeUrls)
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
