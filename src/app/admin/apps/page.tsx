import { asc } from "drizzle-orm";
import { db } from "@/db";
import { apps } from "@/db/schema";
import { AdminChrome } from "../AdminChrome";
import { RecordList } from "../RecordList";
import { saveApp } from "../actions";
import type { Field } from "../RecordForm";

const FIELDS: Field[] = [
  { name: "key", label: "key", kind: "text", readOnly: true },
  { name: "name", label: "名字", kind: "text" },
  { name: "tagline", label: "一句话", kind: "localized" },
  { name: "description", label: "描述", kind: "localizedArea" },
  {
    name: "category",
    label: "分类",
    kind: "select",
    options: ["desktop", "tool", "game", "website"],
  },
  { name: "website", label: "网址", kind: "text" },
  { name: "platforms", label: "平台（逗号分隔）", kind: "text" },
  { name: "accent", label: "主色（hex）", kind: "text", placeholder: "#b45309" },
  { name: "hue", label: "示意图色相（0–360）", kind: "number" },
  { name: "sort", label: "排序", kind: "number" },
];

export default async function AppsPage() {
  const rows = await db.select().from(apps).orderBy(asc(apps.sort));

  return (
    <AdminChrome title="软件">
      <RecordList
        action={saveApp}
        fields={FIELDS}
        rows={rows.map((row) => ({
          id: row.key,
          label: row.name,
          meta: row.category,
          data: { ...row, platforms: row.platforms.join(", ") },
        }))}
      />
    </AdminChrome>
  );
}
