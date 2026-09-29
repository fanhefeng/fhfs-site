import { draftMode } from "next/headers";

/**
 * The strip that says a page is showing drafts — only ever drawn for the
 * editor who pressed "see it on the site" in /admin (Draft Mode, see
 * `app/admin/preview`), so its words are the admin's, in Chinese, and not in
 * the catalogue. A plain form: no client code rides along with every page for
 * a strip one person sees.
 */
export async function PreviewBanner() {
  if (!(await draftMode()).isEnabled) return null;
  return (
    <form
      action="/admin/preview/exit"
      method="post"
      lang="zh-CN"
      className="fixed inset-x-0 bottom-0 z-[95] flex items-center justify-center gap-4 bg-fg px-4 py-2.5 font-mono text-meta text-bg print:hidden"
    >
      <span>草稿预览：这个浏览器里看得到未公开的内容，缓存也全部跳过。</span>
      <button type="submit" className="underline underline-offset-4 hover:text-accent">
        退出预览
      </button>
    </form>
  );
}
