import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { moments } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
import { site } from "@/config/site";
import { stampInZone } from "@/lib/moments";
import { AdminChrome } from "../AdminChrome";
import { RecordList } from "../RecordList";
import { deleteMoment, saveMoment } from "../actions";
import type { Field } from "../RecordForm";

const FIELDS: Field[] = [
  { name: "key", label: "key", kind: "text", readOnly: true, placeholder: "m-2026-09-07-1" },
  {
    name: "postedAt",
    label: "时间（上海时间，到分钟）",
    kind: "text",
    placeholder: "2026-09-07 23:15",
  },
  { name: "content", label: "正文", kind: "area", rows: 8, hint: "换行会照原样显示。" },
  { name: "collection", label: "文集（可空）", kind: "text", placeholder: "峰言疯语" },
  { name: "original", label: "原创", kind: "select", options: ["yes", "no"] },
  { name: "attribution", label: "出处 / 作者（摘录时填）", kind: "text" },
  { name: "mood", label: "心情 / 标签（可空）", kind: "text" },
  { name: "source", label: "来源标记（导入自一言的是 yiyan，自己写的留空）", kind: "text" },
  { name: "draft", label: "草稿（yes 则不公开）", kind: "select", options: ["no", "yes"] },
];

/** A new line, dated now to the minute in the site's zone. */
function blank() {
  const { time } = stampInZone(new Date().toISOString(), site.timeZone);
  const [day, clock] = time.split(" ");
  return {
    key: "",
    postedAt: `${day.replaceAll(".", "-")} ${clock}`,
    content: "",
    collection: "",
    original: "yes",
    attribution: "",
    mood: "",
    source: "",
    draft: "no",
  };
}

export default async function MomentsAdminPage() {
  await requireAdminPage();
  const rows = await db
    .select()
    .from(moments)
    .orderBy(desc(moments.postedAt), asc(moments.key));

  return (
    <AdminChrome title="说说 · 多的是你不知道的事">
      <p className="mb-6 max-w-[70ch] text-caption text-fg-tertiary">
        一条说说就是几行字和一个时间。时间按上海时间写到分钟；「原创」选 no 的会显示成摘录，并带上出处。
        前 242 条是从一言 App 搬来的，来源标记为 yiyan。
      </p>
      <RecordList
        action={saveMoment}
        deleteAction={deleteMoment}
        fields={FIELDS}
        blank={blank()}
        blankLabel="写一条"
        rows={rows.map((row) => {
          const { time } = stampInZone(row.postedAt.toISOString(), site.timeZone);
          const [day, clock] = time.split(" ");
          const firstLine = row.content.split("\n").find(Boolean) ?? "";
          return {
            id: row.key,
            label: firstLine.length > 40 ? `${firstLine.slice(0, 40)}…` : firstLine,
            meta: `${time}${row.collection ? ` · ${row.collection}` : ""}${row.draft ? " · 草稿" : ""}`,
            data: {
              ...row,
              postedAt: `${day.replaceAll(".", "-")} ${clock}`,
              original: row.original ? "yes" : "no",
              draft: row.draft ? "yes" : "no",
            },
          };
        })}
      />
    </AdminChrome>
  );
}
