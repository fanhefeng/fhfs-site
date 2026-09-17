import { asc } from "drizzle-orm";
import { db } from "@/db";
import { experiments } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome } from "../AdminChrome";
import { RecordList } from "../RecordList";
import { deleteExperiment, saveExperiment } from "../actions";
import type { Field, RecordData } from "../RecordForm";
import { Note } from "../ui/Note";

const FIELDS: Field[] = [
  { name: "key", label: "key", kind: "text", readOnly: true },
  { name: "name", label: "名字", kind: "localized" },
  { name: "description", label: "一段话", kind: "localizedArea", rows: 4 },
  {
    name: "status",
    label: "状态",
    kind: "select",
    options: [
      { value: "live", label: "live · 在跑", hint: "站上点得开，效果是真的" },
      { value: "wip", label: "wip · 在做", hint: "动工了，还没上线" },
      { value: "planned", label: "planned · 想做", hint: "只是个念头，别写成已完成" },
    ],
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
    .orderBy(asc(experiments.sort), asc(experiments.key));

  const blank: RecordData = {
    key: "",
    name: { zh: "", en: "" },
    description: { zh: "", en: "" },
    status: "live",
    accent: "",
    href: "",
    demo: "",
    sort: (rows.at(-1)?.sort ?? -1) + 1,
  };

  return (
    <AdminChrome title="实验" section="/admin/experiments">
      <Note>
        状态要说实话。不是这里实现的就填外链指回出处；效果从站上撤掉了，这里也要跟着撤——
        删掉，或者至少把状态改掉。
      </Note>
      <RecordList
        action={saveExperiment}
        deleteAction={deleteExperiment}
        fields={FIELDS}
        unit="个"
        rows={rows.map((row) => ({
          id: row.key,
          label: row.name.zh,
          meta: row.status,
          data: row,
        }))}
        blank={blank}
        blankLabel="新实验"
      />
    </AdminChrome>
  );
}
