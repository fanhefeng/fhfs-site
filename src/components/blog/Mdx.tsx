import { MDXContent } from "@content-collections/mdx/react";

export function Mdx({ code }: { code: string }) {
  return (
    <div className="prose-club">
      <MDXContent code={code} />
    </div>
  );
}
