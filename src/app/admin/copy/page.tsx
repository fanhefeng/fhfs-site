import { asc } from "drizzle-orm";
import { db } from "@/db";
import { copyBlocks } from "@/db/schema";
import { AdminChrome } from "../AdminChrome";
import { CopyForm } from "./CopyForm";

export default async function CopyPage() {
  const rows = await db
    .select()
    .from(copyBlocks)
    .orderBy(asc(copyBlocks.key));

  return (
    <AdminChrome title="站点文案">
      <p className="mb-8 max-w-[70ch] text-caption text-fg-tertiary">
        这些是覆盖层：<code>messages/*.json</code> 里存着同样的默认值，
        清空某一条它就回到文件里的写法。按钮、导航之类的界面标签不在这里，
        仍然只在 JSON 里。
      </p>
      <CopyForm rows={rows} />
    </AdminChrome>
  );
}
