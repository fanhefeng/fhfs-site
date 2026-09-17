import { asc } from "drizzle-orm";
import { db } from "@/db";
import { works } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
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
      <Note>这里一条都没有时，旧的作品页会显示「正在布展」的空状态——那是有意的，不是坏了。</Note>

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
