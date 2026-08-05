import { asc } from "drizzle-orm";
import { db } from "@/db";
import { introNodes } from "@/db/schema";
import { AdminChrome } from "../AdminChrome";
import { RecordList } from "../RecordList";
import { saveIntroNode } from "../actions";
import type { Field } from "../RecordForm";

const FIELDS: Field[] = [
  { name: "key", label: "key", kind: "text", readOnly: true },
  { name: "kicker", label: "小标题", kind: "localized" },
  { name: "title", label: "标题", kind: "localized" },
  { name: "period", label: "时间段（可空）", kind: "localized" },
  { name: "body", label: "正文", kind: "localizedArea", rows: 4 },
  { name: "bullets", label: "要点", kind: "lines", hint: "一行一条，空行忽略。" },
  { name: "stickerLabel", label: "贴纸文字", kind: "text" },
  { name: "stickerIcon", label: "贴纸 emoji", kind: "text" },
  { name: "sort", label: "排序", kind: "number" },
];

export default async function IntroPage() {
  const rows = await db.select().from(introNodes).orderBy(asc(introNodes.sort));

  return (
    <AdminChrome title="简历节点">
      <p className="mb-6 max-w-[70ch] text-caption text-fg-tertiary">
        每条对应 <code>/intro</code> 上头像的一张贴纸，靠 key 关联。贴纸的位置、
        大小、角度是手工标定的 3D 参数，留在代码里（<code>lib/intro/stickers.ts</code>）——
        这里改的是文字。key 在那边没有对应贴纸的话，这条不会被访问到。
      </p>
      <RecordList
        action={saveIntroNode}
        fields={FIELDS}
        rows={rows.map((row) => ({
          id: row.key,
          label: `${row.stickerIcon}  ${row.title.zh}`,
          meta: row.stickerLabel,
          data: row,
        }))}
      />
    </AdminChrome>
  );
}
