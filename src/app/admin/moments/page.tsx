import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { moments } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
import { site } from "@/config/site";
import { stampInZone } from "@/lib/moments";
import { AdminChrome } from "../AdminChrome";
import { RecordList } from "../RecordList";
import { deleteMoment, saveMoment } from "../actions/moments";
import type { Field } from "../RecordForm";
import { Note } from "../ui/Note";

const FIELDS: Field[] = [
  { name: "key", label: "key", kind: "text", readOnly: true, placeholder: "m-2026-09-07-1" },
  {
    name: "postedAt",
    label: "时间（上海时间，到分钟）",
    kind: "text",
    placeholder: "2026-09-07 23:15",
  },
  { name: "content", label: "正文", kind: "area", rows: 8, hint: "换行会照原样显示。" },
  {
    name: "original",
    label: "这句是谁的",
    kind: "select",
    options: [
      { value: "yes", label: "自己写的" },
      { value: "no", label: "摘录别人的" },
    ],
    group: "出处",
  },
  {
    name: "attribution",
    label: "出处 / 作者",
    kind: "text",
    hint: "摘录时填，前台会跟在句子后面。",
    group: "出处",
  },
  {
    name: "collection",
    label: "文集（可空）",
    kind: "text",
    placeholder: "峰言疯语",
    group: "出处",
  },
  {
    name: "source",
    label: "来源标记",
    kind: "text",
    hint: "从一言 App 搬来的那 242 条是 yiyan，自己在这里写的留空。",
    group: "出处",
  },
  { name: "mood", label: "心情 / 标签（可空）", kind: "text", group: "状态" },
  {
    name: "draft",
    label: "公开",
    kind: "select",
    options: [
      { value: "no", label: "已公开" },
      { value: "yes", label: "草稿" },
    ],
    group: "状态",
  },
];

/** A new line, dated now to the minute in the site's zone. */
function blank() {
  const { time } = stampInZone(new Date().toISOString(), site.timeZone);
  const [day, clock] = time.split(" ");
  return {
    key: "",
    postedAt: `${day!.replaceAll(".", "-")} ${clock}`,
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
  const rows = await db.select().from(moments).orderBy(desc(moments.postedAt), asc(moments.key));

  return (
    <AdminChrome title="说说" section="/admin/moments">
      <Note>
        时间按上海时间写到分钟，写错一分钟就换一个位置——板子是按时刻排的。 key
        是这条说说的身份，存下就别改。
      </Note>
      <RecordList
        action={saveMoment}
        deleteAction={deleteMoment}
        fields={FIELDS}
        blank={blank()}
        blankLabel="写一条"
        unit="条"
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
              postedAt: `${day!.replaceAll(".", "-")} ${clock}`,
              original: row.original ? "yes" : "no",
              draft: row.draft ? "yes" : "no",
            },
          };
        })}
      />
    </AdminChrome>
  );
}
