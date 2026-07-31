import { MDXContent } from "@content-collections/mdx/react";

/**
 * MDX body wrapper. All typography lives in the `.prose-editorial` rules in
 * globals.css (68ch measure, serif pull quotes, amber underlines, dual-theme
 * code blocks) — the component stays a plain container so article pages never
 * grow prose styling of their own.
 *
 * Deliberately unanimated: the reading column is the one place on the site
 * where nothing moves.
 */
export function Mdx({ code, className }: { code: string; className?: string }) {
  return (
    <div className={`prose-editorial ${className ?? ""}`}>
      <MDXContent code={code} />
    </div>
  );
}
