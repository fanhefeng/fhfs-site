import { asc, desc } from "drizzle-orm";
import { db } from "@/db";
import { moments } from "@/db/schema";
import { requireAdminPage } from "@/lib/server/auth/session";
import { site } from "@/config/site";
import { formatMedia } from "@/lib/forms";
import { describeMedia, momentKey, stampInZone } from "@/lib/moments";
import { AdminChrome } from "../AdminChrome";
import { RecordList } from "../ui/RecordList";
import { deleteMoment, saveMoment } from "../actions/moments";
import type { Field } from "../ui/RecordForm";
import { Note } from "../ui/Note";

const FIELDS: Field[] = [
  {
    name: "key",
    label: "key",
    kind: "text",
    readOnly: true,
    placeholder: "m-20260907-231500",
    hint: "已经按现在的时刻填好了，不用管它。想自己起也行：小写字母、数字、连字符。",
  },
  {
    name: "postedAt",
    label: "时间（上海时间，到分钟）",
    kind: "text",
    placeholder: "2026-09-07 23:15",
  },
  {
    name: "content",
    label: "正文",
    kind: "area",
    rows: 8,
    hint: "换行会照原样显示。只有图或语音的一条可以留空。",
  },
  {
    name: "media",
    label: "图片 / 语音 / 视频（可空）",
    kind: "area",
    rows: 4,
    upload: "moments",
    hint: "用下面的按钮上传，尺寸、时长和视频封面会自动量好填进来。也可以手写，一行一个：image /moments/x.jpg 1080x1440 · audio /moments/x.m4a 90s · video https://… 720x1280 30s poster=/moments/x.jpg；站内文件放 public/moments/ 后先跑 pnpm assets。",
  },
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
    placeholder: "峰言峰语",
    group: "出处",
  },
  {
    name: "source",
    label: "来源标记",
    kind: "text",
    hint: "从一言 App 搬来的那 242 条是 yiyan，其余留空。",
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
  {
    name: "pinned",
    label: "置顶",
    kind: "select",
    options: [
      { value: "no", label: "不置顶" },
      { value: "yes", label: "置顶" },
    ],
    hint: "置顶的排在板子最上面，不止一条时按时间排。首页卡片不看置顶，只显示最新发的一条。",
    group: "状态",
  },
];

/** A new line, dated now to the minute in the site's zone, and keyed by the
 *  same instant — the key is an identity, not something worth composing. */
function blank() {
  const now = new Date().toISOString();
  const { time } = stampInZone(now, site.timeZone);
  const [day, clock] = time.split(" ");
  return {
    key: momentKey(now, site.timeZone),
    postedAt: `${day!.replaceAll(".", "-")} ${clock}`,
    content: "",
    media: "",
    collection: "",
    original: "yes",
    attribution: "",
    mood: "",
    source: "",
    draft: "no",
    pinned: "no",
  };
}

export default async function MomentsAdminPage() {
  await requireAdminPage();
  const rows = await db
    .select()
    .from(moments)
    .orderBy(desc(moments.pinned), desc(moments.postedAt), asc(moments.key));

  return (
    <AdminChrome title="说说" section="/admin/moments">
      <Note>
        时间按上海时间写到分钟，写错一分钟就换一个位置——板子是按时刻排的。 key
        是这条说说的身份，只要不重复就行：新写的会自动填好，存下之后不能改。
      </Note>
      <RecordList
        action={saveMoment}
        deleteAction={deleteMoment}
        fields={FIELDS}
        blank={blank()}
        blankLabel="写一条"
        unit="条"
        rows={rows.map(({ id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...row }) => {
          const { time } = stampInZone(row.postedAt.toISOString(), site.timeZone);
          const [day, clock] = time.split(" ");
          const firstLine = row.content.split("\n").find(Boolean) ?? "";
          // A line that is only a file is listed by what the file is — the
          // row is not empty, it just has nothing to quote.
          const files = describeMedia(row.media);
          const label = firstLine
            ? firstLine.length > 40
              ? `${firstLine.slice(0, 40)}…`
              : firstLine
            : files
              ? `［${files}］`
              : "";
          return {
            id: row.key,
            label,
            meta: `${row.pinned ? "置顶 · " : ""}${time}${row.collection ? ` · ${row.collection}` : ""}${firstLine && files ? ` · ${files}` : ""}${row.draft ? " · 草稿" : ""}`,
            draft: row.draft,
            data: {
              ...row,
              media: formatMedia(row.media),
              postedAt: `${day!.replaceAll(".", "-")} ${clock}`,
              original: row.original ? "yes" : "no",
              draft: row.draft ? "yes" : "no",
              pinned: row.pinned ? "yes" : "no",
            },
          };
        })}
      />
    </AdminChrome>
  );
}
