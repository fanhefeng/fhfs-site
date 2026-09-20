import Link from "next/link";
import { asc } from "drizzle-orm";
import { db } from "@/db";
import { copyBlocks } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
import {
  COPY_GROUPS,
  COPY_NOTES,
  isScreenReaderOnly,
  namespaceOf,
  type CopyEntry,
} from "@/lib/copy";
import { copyCatalogues } from "@/lib/copyCatalogue";
import { AdminChrome } from "../AdminChrome";
import { cardClass, metaClass } from "../styles";
import { Note } from "../ui/Note";
import { CopyForm } from "./CopyForm";
import { OrphanCopy } from "./OrphanCopy";

/**
 * The copy editor, entered through its groups.
 *
 * One page per namespace rather than all of it at once: the whole catalogue is
 * 885 lines, and a single form carrying 1770 inputs is both a slow page and a
 * save that rewrites everything to change one word. A group is small enough to
 * read, and several of its lines only make sense next to each other — the
 * footer's two time fragments are a word-order pair, the slogan and its echo
 * are the same sentence twice — which is why the group, and not the row, is
 * the unit being edited.
 */
export default async function CopyPage({ searchParams }: PageProps<"/admin/copy">) {
  await requireAdminPage();
  const { ns } = await searchParams;
  const group = COPY_GROUPS.find((candidate) => candidate.id === ns);

  const [{ zh, en }, rows] = await Promise.all([
    copyCatalogues(),
    db.select().from(copyBlocks).orderBy(asc(copyBlocks.key)),
  ]);
  const overrides = new Map(rows.map((row) => [row.key, row]));

  if (!group) {
    // Rows for a key the catalogue no longer has. `merge()` adds them to the
    // catalogue as new keys, where nothing reads them — harmless, invisible,
    // and impossible to reach from any group, so they are listed here instead.
    const orphans = rows.filter((row) => !(row.key in zh)).map((row) => row.key);

    return (
      <AdminChrome title="站点文案" section="/admin/copy">
        <Note>
          <p>
            <code>messages/*.json</code> 是全部默认文案，这里只存<b>你改过的那几条</b>
            。改一条，站上就按你写的说；<b>把输入框清空，那条就回到文件里的默认写法</b>
            ——不会变成空白。
          </p>
          <p>
            所以想让某处真的留空，得把默认本身改成空的（比如页脚时钟两侧那两条）。
            每条下面都写着当前的默认值。
          </p>
        </Note>

        <div className="grid gap-3 sm:grid-cols-2">
          {COPY_GROUPS.map((candidate) => {
            const keys = Object.keys(zh).filter((key) => namespaceOf(key) === candidate.id);
            const edited = keys.filter((key) => overrides.has(key)).length;
            const spoken = keys.filter(isScreenReaderOnly).length;
            return (
              <Link
                key={candidate.id}
                href={`/admin/copy?ns=${candidate.id}`}
                className={`${cardClass} group p-4 transition-colors hover:border-fg-tertiary/40`}
              >
                <p className="flex items-baseline justify-between gap-3">
                  <span className="text-body text-fg transition-colors group-hover:text-accent">
                    {candidate.label}
                  </span>
                  <span className={`${metaClass} shrink-0 tabular-nums`}>
                    {keys.length} 条
                    {edited > 0 && <span className="text-accent"> · 改过 {edited}</span>}
                  </span>
                </p>
                <p className="mt-1.5 text-caption text-fg-tertiary">
                  {candidate.blurb}
                  {/* Worth saying on the way in: a group that is mostly alt
                      text reads as a wall of prose nobody can find on screen. */}
                  {spoken > 0 && <span className="opacity-70">（其中 {spoken} 条只给读屏）</span>}
                </p>
              </Link>
            );
          })}
        </div>

        {orphans.length > 0 && <OrphanCopy keys={orphans} />}
      </AdminChrome>
    );
  }

  const entries: CopyEntry[] = Object.keys(zh)
    .filter((key) => namespaceOf(key) === group.id)
    .sort()
    .map((key) => {
      const row = overrides.get(key);
      const zhDefault = zh[key]!;
      const enDefault = en[key] ?? "";
      return {
        key,
        zh: row?.zh ?? zhDefault,
        en: row?.en ?? enDefault,
        zhDefault,
        enDefault,
        overridden: Boolean(row),
        screenReader: isScreenReaderOnly(key),
        note: COPY_NOTES[key],
      };
    });

  return (
    <AdminChrome title={group.label} section="/admin/copy" blurb={group.blurb} sub>
      <CopyForm namespace={group.id} entries={entries} />
    </AdminChrome>
  );
}
