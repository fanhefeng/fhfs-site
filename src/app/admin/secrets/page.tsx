import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { secrets } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome } from "../AdminChrome";
import { ghostButtonClass } from "../styles";
import { Note } from "../ui/Note";

export default async function SecretsIndex() {
  await requireAdminPage();
  const rows = await db
    .select({
      slug: secrets.slug,
      locale: secrets.locale,
      kind: secrets.kind,
      title: secrets.title,
      date: secrets.date,
      draft: secrets.draft,
      duration: secrets.duration,
      readingMinutes: secrets.readingMinutes,
    })
    .from(secrets)
    .orderBy(desc(secrets.date), asc(secrets.locale));

  return (
    <AdminChrome
      title="秘密"
      section="/admin/secrets"
      action={
        <Link href="/admin/secrets/new" className={ghostButtonClass}>
          <span aria-hidden className="text-fg-tertiary">
            +
          </span>
          写新的
        </Link>
      }
    >
      {rows.length === 0 && (
        <Note>还一篇都没有。随笔直接写；播客填上音频地址和时长，正文当节目笔记。</Note>
      )}
      <ul className="divide-y divide-line border-y border-line">
        {rows.map((row) => (
          <li key={`${row.slug}.${row.locale}`}>
            <Link
              href={`/admin/secrets/${row.slug}/${row.locale}`}
              className="group flex min-h-12 flex-wrap items-baseline gap-x-4 gap-y-1 px-2 py-3 transition-colors hover:bg-surface/60"
            >
              <span className="font-mono text-meta text-fg-tertiary tabular-nums">{row.date}</span>
              <span className="font-mono text-meta uppercase text-fg-tertiary">{row.locale}</span>
              <span className="font-mono text-meta text-accent">
                {row.kind === "podcast" ? "播客" : "随笔"}
              </span>
              <span className="flex-1 text-body transition-colors group-hover:text-accent">
                {row.title}
              </span>
              {row.draft && (
                <span className="font-mono text-meta uppercase tracking-meta text-accent">
                  草稿
                </span>
              )}
              <span className="font-mono text-meta text-fg-tertiary tabular-nums">
                {row.kind === "podcast" ? `${row.duration ?? "?"}m` : `${row.readingMinutes}m`}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </AdminChrome>
  );
}
