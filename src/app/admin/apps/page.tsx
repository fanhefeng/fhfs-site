import { asc } from "drizzle-orm";
import { db } from "@/db";
import { apps } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome } from "../AdminChrome";
import { RecordList } from "../RecordList";
import { deleteApp, saveApp } from "../actions";
import type { Field, RecordData } from "../RecordForm";

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
  {
    name: "repo",
    label: "GitHub 仓库（owner/name）",
    kind: "text",
    placeholder: "fanhefeng/fhfs-site",
    hint: "站点上这款软件旁边的版本徽章，读的是这个仓库的最新 release；留空就不显示版本。",
  },
  { name: "platforms", label: "平台（逗号分隔）", kind: "text" },
  { name: "accent", label: "主色（hex）", kind: "text", placeholder: "#b45309" },
  { name: "hue", label: "示意图色相（0–360）", kind: "number" },
  { name: "sort", label: "排序", kind: "number" },
];

export default async function AppsPage() {
  await requireAdminPage();
  const rows = await db
    .select()
    .from(apps)
    .orderBy(asc(apps.sort), asc(apps.key));

  // Built per render: the default sort has to sit after whatever is there now.
  const blank: RecordData = {
    key: "",
    name: "",
    tagline: { zh: "", en: "" },
    description: { zh: "", en: "" },
    category: "desktop",
    website: "",
    repo: "",
    platforms: "",
    accent: "",
    hue: "",
    sort: (rows.at(-1)?.sort ?? -1) + 1,
  };

  return (
    <AdminChrome title="软件">
      <p className="mb-6 max-w-[70ch] text-caption text-fg-tertiary">
        软件页的每一张卡片。key 存下来就不能改；版本号不在这里填，填仓库让站点自己去读。
      </p>
      <RecordList
        action={saveApp}
        deleteAction={deleteApp}
        fields={FIELDS}
        rows={rows.map((row) => ({
          id: row.key,
          label: row.name,
          meta: row.category,
          data: { ...row, platforms: row.platforms.join(", ") },
        }))}
        blank={blank}
        blankLabel="新软件"
      />
    </AdminChrome>
  );
}
