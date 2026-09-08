import { asc } from "drizzle-orm";
import { db } from "@/db";
import { timelineEntries } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome } from "../AdminChrome";
import { RecordList } from "../RecordList";
import { deleteTimelineEntry, saveTimelineEntry } from "../actions";
import type { Field, RecordData } from "../RecordForm";

const FIELDS: Field[] = [
  { name: "key", label: "key", kind: "text", readOnly: true },
  { name: "version", label: "版本号", kind: "text", placeholder: "5.1" },
  { name: "date", label: "日期（留空则用下面的占位文字）", kind: "text", placeholder: "2026-07-31" },
  { name: "dateLabel", label: "日期占位文字", kind: "localized" },
  { name: "title", label: "标题", kind: "localized" },
  { name: "note", label: "说明", kind: "localizedArea" },
  { name: "sort", label: "排序（小的在前 = 新的在上）", kind: "number" },
];

export default async function TimelinePage() {
  await requireAdminPage();
  const rows = await db
    .select()
    .from(timelineEntries)
    .orderBy(asc(timelineEntries.sort), asc(timelineEntries.key));

  // Sort ascends newest-first, so a new entry lands at the bottom — the
  // oldest slot — and is moved up by hand if it belongs higher.
  const blank: RecordData = {
    key: "",
    version: "",
    date: "",
    dateLabel: { zh: "", en: "" },
    title: { zh: "", en: "" },
    note: { zh: "", en: "" },
    sort: (rows.at(-1)?.sort ?? -1) + 1,
  };

  return (
    <AdminChrome title="版本履历">
      <p className="mb-6 max-w-[70ch] text-caption text-fg-tertiary">
        日期和占位文字至少要有一个。查不到确切日期就填占位文字——这一栏不编造日期。
      </p>
      <RecordList
        action={saveTimelineEntry}
        deleteAction={deleteTimelineEntry}
        fields={FIELDS}
        rows={rows.map((row) => ({
          id: row.key,
          label: `${row.version}  ${row.title.zh}`,
          meta: row.date ?? row.dateLabel?.zh ?? "待填",
          data: row,
        }))}
        blank={blank}
        blankLabel="新条目"
      />
    </AdminChrome>
  );
}
