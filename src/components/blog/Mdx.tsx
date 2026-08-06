/**
 * Article body wrapper. All typography lives in the `.prose-editorial` rules
 * in globals.css (68ch measure, serif pull quotes, amber underlines,
 * dual-theme code blocks) — the component stays a plain container so article
 * pages never grow prose styling of their own.
 *
 * The HTML arrives already rendered: prose is turned into markup once, when
 * it is saved, by the unified pipeline in `lib/markdown.ts`. Nothing here
 * parses or evaluates anything, and the page ships no markdown runtime.
 *
 * `dangerouslySetInnerHTML` is sound in this direction: the source is the
 * author's own markdown, the pipeline never enables `allowDangerousHtml`, and
 * there is exactly one author. Open this up to other writers and it needs a
 * `rehype-sanitize` pass first.
 *
 * Deliberately unanimated: the reading column is the one place on the site
 * where nothing moves.
 */
export function Mdx({ html }: { html: string }) {
  return (
    <div className="prose-editorial" dangerouslySetInnerHTML={{ __html: html }} />
  );
}
