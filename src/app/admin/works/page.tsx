import { asc } from "drizzle-orm";
import { db } from "@/db";
import { works } from "@/db/schema";
import { AdminChrome } from "../AdminChrome";
import { WorkForm, type WorkDraft } from "./WorkForm";

const BLANK: WorkDraft = {
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

export default async function WorksPage() {
  const rows = await db
    .select()
    .from(works)
    .orderBy(asc(works.sort), asc(works.key));

  return (
    <AdminChrome title="作品集">
      <p className="mb-8 max-w-[70ch] text-caption text-fg-tertiary">
        作品页的「在展作品」。这里一条都没有时，页面会显示「正在布展」的空状态——
        那是有意的，不是坏了。
      </p>

      <div className="space-y-12">
        {rows.map((work) => (
          <section key={work.key}>
            <h2 className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
              {work.key}
            </h2>
            <div className="mt-3">
              <WorkForm isNew={false} work={work} />
            </div>
          </section>
        ))}

        <section className="border-t border-line pt-8">
          <h2 className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            新作品
          </h2>
          <div className="mt-3">
            <WorkForm isNew work={BLANK} />
          </div>
        </section>
      </div>
    </AdminChrome>
  );
}
