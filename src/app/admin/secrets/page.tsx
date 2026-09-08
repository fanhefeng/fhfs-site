import Link from "next/link";
import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { secrets } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome } from "../AdminChrome";

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
      title="秘密 · 不能说的秘密"
      action={
        <Link
          href="/admin/secrets/new"
          className="min-h-11 rounded-card border border-line px-4 py-2.5 text-caption hover:border-accent hover:text-accent"
        >
          写新的
        </Link>
      }
    >
      {rows.length === 0 && (
        <p className="mb-6 max-w-[70ch] text-caption text-fg-tertiary">
          还一篇都没有。随笔直接写；播客填上音频地址和时长，正文当节目笔记。
        </p>
      )}
      <ul className="divide-y divide-line border-y border-line">
        {rows.map((row) => (
          <li key={`${row.slug}.${row.locale}`}>
            <Link
              href={`/admin/secrets/${row.slug}/${row.locale}`}
              className="flex min-h-11 flex-wrap items-baseline gap-x-4 gap-y-1 py-3 hover:text-accent"
            >
              <span className="font-mono text-meta text-fg-tertiary tabular-nums">{row.date}</span>
              <span className="font-mono text-meta uppercase text-fg-tertiary">{row.locale}</span>
              <span className="font-mono text-meta text-accent">{row.kind === "podcast" ? "播客" : "随笔"}</span>
              <span className="flex-1 text-body">{row.title}</span>
              {row.draft && (
                <span className="font-mono text-meta uppercase tracking-meta text-accent">草稿</span>
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
