import { asc } from "drizzle-orm";
import { db } from "@/db";
import { copyBlocks } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome } from "../AdminChrome";
import { CopyForm } from "./CopyForm";
import { Note } from "../ui/Note";

export default async function CopyPage() {
  await requireAdminPage();
  const rows = await db.select().from(copyBlocks).orderBy(asc(copyBlocks.key));

  return (
    <AdminChrome title="站点文案" section="/admin/copy">
      <Note>
        这些是覆盖层：<code>messages/*.json</code> 里存着同样的默认值， 这里写什么，站上就是什么——
        <b>清空一条，站上那一处就是空的</b>，
        不会回到文件里的写法（页脚时钟两侧那几条就是故意留空的）。 想恢复默认，把 JSON
        里的原文贴回来。按钮、导航之类的界面标签不在这里， 仍然只在 JSON 里。
      </Note>
      <CopyForm rows={rows} />
    </AdminChrome>
  );
}
