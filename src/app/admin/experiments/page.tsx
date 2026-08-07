import { asc } from "drizzle-orm";
import { db } from "@/db";
import { experiments } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome } from "../AdminChrome";
import { RecordList } from "../RecordList";
import { saveExperiment } from "../actions";
import type { Field } from "../RecordForm";

const FIELDS: Field[] = [
  { name: "key", label: "key", kind: "text", readOnly: true },
  { name: "name", label: "名字", kind: "localized" },
  { name: "description", label: "一段话", kind: "localizedArea", rows: 4 },
  {
    name: "status",
    label: "状态",
    kind: "select",
    options: ["live", "wip", "planned"],
  },
  { name: "accent", label: "圆点颜色（hex）", kind: "text", placeholder: "#4c7a5b" },
  { name: "href", label: "外链（可空）", kind: "text" },
  { name: "demo", label: "内嵌 demo 组件名（可空）", kind: "text", placeholder: "liquid-lens" },
  { name: "sort", label: "排序", kind: "number" },
];

export default async function ExperimentsPage() {
  await requireAdminPage();
  const rows = await db
    .select()
    .from(experiments)
    .orderBy(asc(experiments.sort));

  return (
    <AdminChrome title="实验">
      <p className="mb-6 max-w-[70ch] text-caption text-fg-tertiary">
        状态要说实话：<code>live</code> 是真的在跑，<code>planned</code> 是还没做。
        不是这里实现的就填外链指回出处。
      </p>
      <RecordList
        action={saveExperiment}
        fields={FIELDS}
        rows={rows.map((row) => ({
          id: row.key,
          label: row.name.zh,
          meta: row.status,
          data: row,
        }))}
      />
    </AdminChrome>
  );
}
