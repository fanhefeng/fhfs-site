import Link from "next/link";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome, SECTIONS } from "./AdminChrome";

/** Reads straight from the table, not through the cached getters — the point
 *  of this page is to show what is actually stored right now. */
async function count(table: string): Promise<number> {
  const result = await db.execute(
    sql.raw(`select count(*)::int as n from ${table}`)
  );
  return (result.rows[0] as { n: number }).n;
}

export default async function AdminHome() {
  await requireAdminPage();
  const counts = await Promise.all(
    SECTIONS.map((section) => count(section.table))
  );

  return (
    <AdminChrome title="内容">
      <ul className="divide-y divide-line border-y border-line">
        {SECTIONS.map((section, i) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className="flex min-h-11 items-baseline justify-between gap-4 py-3 hover:text-accent"
            >
              <span className="text-body">{section.label}</span>
              <span className="font-mono text-meta text-fg-tertiary tabular-nums">
                {counts[i]}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <p className="mt-8 max-w-[60ch] text-caption text-fg-tertiary">
        保存之后前台会立即失效重取，不用重新部署。改动只写进数据库——
        想留一份带 diff 的纯文本副本，在本地跑 <code>pnpm db:export</code> 并提交
        <code> backup/</code>。
      </p>
    </AdminChrome>
  );
}
