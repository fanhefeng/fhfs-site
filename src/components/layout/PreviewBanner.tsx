import { draftMode } from "next/headers";

/**
 * The strip that says a page is showing drafts — only ever drawn for the
 * editor who pressed "see it on the site" in /admin (Draft Mode, see
 * `app/admin/preview`), so its words are the admin's, in Chinese, and not in
 * the catalogue. A plain form: no client code rides along with every page for
 * a strip one person sees. Sticky keeps its height in the document so the
 * last footer controls can scroll completely above it.
 */
export async function PreviewBanner() {
  if (!(await draftMode()).isEnabled) return null;
  return (
    <form
      action="/admin/preview/exit"
      method="post"
      lang="zh-CN"
      className="sticky bottom-0 z-[95] flex flex-wrap items-center justify-center gap-x-4 gap-y-2 bg-fg px-4 pt-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))] font-mono text-meta text-bg print:hidden"
    >
      <span>草稿预览：这个浏览器里看得到未公开的内容，缓存也全部跳过。</span>
      <button
        type="submit"
        className="min-h-11 shrink-0 underline underline-offset-4 hover:text-accent"
      >
        退出预览
      </button>
    </form>
  );
}
