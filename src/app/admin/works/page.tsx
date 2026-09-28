import { asc } from "drizzle-orm";
import { db } from "@/db";
import { works } from "@/db/schema";
import { requireAdminPage } from "@/lib/server/auth/session";
import { AdminChrome } from "../AdminChrome";
import { WorkForm, type WorkDraft } from "./WorkForm";
import { Note } from "../ui/Note";
import { cardClass, metaClass } from "../styles";

export default async function WorksPage() {
  await requireAdminPage();
  const rows = await db.select().from(works).orderBy(asc(works.sort), asc(works.key));

  // Built per render, not at module scope — a warm server instance would
  // otherwise keep last year's default across New Year.
  const blank: WorkDraft = {
    key: "",
    title: { zh: "", en: "" },
    description: { zh: "", en: "" },
    year: new Date().getFullYear(),
    cover: null,
    url: null,
    tags: [],
    accent: null,
    sort: 0,
  };

  return (
    <AdminChrome title="作品集" section="/admin/works">
      <Note>
        /portfolio 已经 308 到 /software，前台没有页面读这张表——这里存的东西目前不会出现在站上。
      </Note>

      <div className="space-y-12">
        {rows.map((work) => (
          <section key={work.key} className={`${cardClass} p-5 sm:p-6`}>
            <h2 className={metaClass}>{work.key}</h2>
            <div className="mt-4">
              <WorkForm isNew={false} work={work} />
            </div>
          </section>
        ))}

        <section className={`${cardClass} p-5 sm:p-6`}>
          <h2 className={metaClass}>新作品</h2>
          <div className="mt-4">
            <WorkForm isNew work={blank} />
          </div>
        </section>
      </div>
    </AdminChrome>
  );
}
