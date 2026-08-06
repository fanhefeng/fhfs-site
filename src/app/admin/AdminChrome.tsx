import Link from "next/link";
import { logout } from "./login/actions";

/** The sections of the admin, in the order they matter. `table` is what the
 *  dashboard counts — kept here so adding a section is a one-line change. */
export const SECTIONS = [
  { href: "/admin/posts", label: "文章", table: "posts" },
  { href: "/admin/about", label: "关于页", table: "abouts" },
  { href: "/admin/copy", label: "站点文案", table: "copy_blocks" },
  { href: "/admin/timeline", label: "版本履历", table: "timeline_entries" },
  { href: "/admin/apps", label: "软件", table: "apps" },
  { href: "/admin/works", label: "作品集", table: "works" },
  { href: "/admin/experiments", label: "实验", table: "experiments" },
  { href: "/admin/intro", label: "简历节点", table: "intro_nodes" },
  { href: "/admin/chips", label: "贴纸墙", table: "chips" },
  { href: "/admin/nav", label: "导航", table: "nav_items" },
] as const;

/**
 * The frame every admin page sits in. Plain on purpose — this is a workbench,
 * not part of the magazine.
 */
export function AdminChrome({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  /** Optional control shown beside the heading, e.g. "new post". */
  action?: React.ReactNode;
}) {
  return (
    <div className="mx-auto w-full max-w-4xl px-6 py-10">
      <header className="flex flex-wrap items-baseline gap-x-4 gap-y-2 border-b border-line pb-4">
        <Link
          href="/admin"
          className="font-mono text-meta uppercase tracking-meta text-fg-tertiary hover:text-accent"
        >
          fhf · admin
        </Link>
        <nav className="flex flex-wrap gap-x-4 gap-y-1 text-caption">
          {SECTIONS.map((section) => (
            <Link
              key={section.href}
              href={section.href}
              className="text-fg-secondary hover:text-accent"
            >
              {section.label}
            </Link>
          ))}
        </nav>
        <form action={logout} className="ml-auto">
          <button
            type="submit"
            className="text-caption text-fg-tertiary hover:text-accent"
          >
            退出
          </button>
        </form>
      </header>

      <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-title">{title}</h1>
        {action}
      </div>

      <div className="mt-6">{children}</div>
    </div>
  );
}

/** Shared field styling, so the forms stay consistent without a component. */
export const inputClass =
  "w-full rounded-card border border-line bg-surface px-3 py-2 text-body text-fg outline-none focus-visible:border-accent";
export const labelClass =
  "block font-mono text-meta uppercase tracking-meta text-fg-tertiary";
export const buttonClass =
  "min-h-11 rounded-card bg-fg px-5 text-caption text-bg transition-opacity disabled:opacity-50";
