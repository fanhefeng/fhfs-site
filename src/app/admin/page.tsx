import Link from "next/link";
import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome } from "./AdminChrome";
import { sectionCounts } from "./counts";
import { SECTION_GROUPS } from "./sections";
import { cardClass, metaClass } from "./styles";

/**
 * The front page of the workbench: every section, in the site's own four
 * groups, each saying how much is in it and what it changes out front.
 *
 * The counts come from `sectionCounts()` — one statement for all thirteen,
 * shared with the sidebar through `React.cache`, and read straight from the
 * tables rather than through the cached getters. The point of the number is
 * that it says what is stored right now.
 */
export default async function AdminHome() {
  await requireAdminPage();
  const counts = await sectionCounts();

  return (
    <AdminChrome title="内容">
      <div className="space-y-10">
        {SECTION_GROUPS.map((group) => (
          <section key={group.id}>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h2 className={metaClass}>{group.label}</h2>
              <p className="text-caption text-fg-tertiary">{group.caption}</p>
            </div>

            <ul className="mt-3 grid gap-3 sm:grid-cols-2">
              {group.sections.map((section) => (
                <li key={section.href}>
                  <Link
                    href={section.href}
                    className={`${cardClass} group flex h-full flex-col gap-2 p-4 transition-[border-color,box-shadow] hover:border-fg-tertiary/30 hover:shadow-card`}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className="text-heading transition-colors group-hover:text-accent">
                        {section.label}
                      </span>
                      <span className="font-mono text-meta text-fg-tertiary tabular-nums">
                        {counts[section.href] ?? 0} {section.unit}
                      </span>
                    </span>
                    <span className="text-caption text-fg-tertiary">{section.blurb}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <p className="mt-10 max-w-[62ch] text-caption text-fg-tertiary">
        保存之后前台会立即失效重取，不用重新部署。改动只写进数据库—— 想留一份带 diff
        的纯文本副本，在本地跑 <code>pnpm db:export</code> 并提交
        <code> backup/</code>。
      </p>
    </AdminChrome>
  );
}
