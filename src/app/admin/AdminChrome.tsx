import Link from "next/link";
import { sectionCounts } from "./counts";
import { groupOf, sectionByHref } from "./sections";
import { ghostButtonClass, metaClass } from "./styles";
import { AdminSidebar } from "./AdminSidebar";

/**
 * The frame every admin page sits in: the standing sidebar, and a header that
 * says where you are and what editing this page actually changes.
 *
 * A page identifies itself by its section href rather than by repeating its
 * own name — the label, the one-line blurb and the link to the page out front
 * all come from `./sections`, the same list the sidebar is built from, so the
 * admin and the site can't drift apart in wording. Sub-pages (a single post,
 * a single episode) pass their parent's href and their own title.
 *
 * Still plain, still a workbench — but a workbench with its tools laid out.
 */
export async function AdminChrome({
  title,
  section,
  children,
  action,
  /** Overrides the section's own blurb — for sub-pages with something else to say. */
  blurb,
  view,
}: {
  title: string;
  /** The section this page belongs to, as its /admin/… href. */
  section?: string;
  children: React.ReactNode;
  /** Optional control shown beside the heading, e.g. "new post". */
  action?: React.ReactNode;
  blurb?: string;
  /**
   * Where "看前台" should point, overriding the section's own page: a single
   * post links to itself rather than to the index. `null` drops the link —
   * a draft has nothing to show.
   */
  view?: string | null;
}) {
  const counts = await sectionCounts();
  const meta = section ? sectionByHref(section) : undefined;
  const group = section ? groupOf(section) : undefined;
  // A sub-page counts nothing of its own — the number belongs to the section.
  const count = section && view === undefined ? counts[section] : undefined;
  const viewHref =
    view !== undefined ? view : meta?.view ? `/zh${meta.view}` : null;

  return (
    <div className="lg:flex">
      <AdminSidebar counts={counts} />

      <main className="min-w-0 flex-1">
        <div className="mx-auto w-full max-w-4xl px-5 py-8 sm:px-8 lg:py-12">
          <header className="border-b border-line pb-6">
            {/* The dashboard is "内容" itself — a crumb pointing at the page you
                are already on is furniture, so it only appears below it. */}
            <p className={`${metaClass} ${section ? "" : "hidden"}`}>
              <Link href="/admin" className="transition-colors hover:text-accent">
                内容
              </Link>
              {group && (
                <>
                  <span className="mx-1.5 opacity-50">›</span>
                  {group.label}
                </>
              )}
              {/* A sub-page (one post, one episode) names its section too, and
                  links back to it — that list is where it came from. */}
              {view !== undefined && meta && (
                <>
                  <span className="mx-1.5 opacity-50">›</span>
                  <Link
                    href={meta.href}
                    className="transition-colors hover:text-accent"
                  >
                    {meta.label}
                  </Link>
                </>
              )}
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-x-5 gap-y-3">
              <h1 className="flex items-baseline gap-3 text-title">
                {title}
                {count !== undefined && meta && (
                  <span className="font-mono text-meta text-fg-tertiary tabular-nums">
                    {count} {meta.unit}
                  </span>
                )}
              </h1>

              <div className="flex flex-wrap items-center gap-3">
                {viewHref && (
                  <a
                    href={viewHref}
                    target="_blank"
                    rel="noreferrer"
                    className={ghostButtonClass}
                  >
                    看前台
                    <svg viewBox="0 0 12 12" aria-hidden className="size-3">
                      <path
                        d="M4 2h6v6M10 2 3 9"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.4"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </a>
                )}
                {action}
              </div>
            </div>

            {(blurb ?? meta?.blurb) && (
              <p className="mt-3 max-w-[70ch] text-caption text-fg-tertiary">
                {blurb ?? meta?.blurb}
              </p>
            )}
          </header>

          <div className="mt-8">{children}</div>
        </div>
      </main>
    </div>
  );
}

/* The shared field styling the forms use lives in `./styles` — a module with
   no imports at all. It used to sit here, and this file's `import * as schema`
   followed it into the client bundle of every admin page; the note at the top
   of that file says what that cost. The section list moved to `./sections` for
   the same reason: the sidebar is a client component. */
