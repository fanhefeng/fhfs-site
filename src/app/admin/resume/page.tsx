import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { resumeExperiences, resumeProfiles } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
import { AdminChrome } from "../AdminChrome";
import { RecordForm, type Field } from "../RecordForm";
import { saveResumeProfile } from "../actions";
import { ExperienceForm, type ExperienceDraft } from "./ExperienceForm";

const PROFILE_FIELDS: Field[] = [
  { name: "name", label: "名字", kind: "localized" },
  { name: "tagline", label: "一句话（角色/定位）", kind: "localized" },
  {
    name: "intro",
    label: "自我介绍",
    kind: "lines",
    hint: "一行一段，空行忽略。",
  },
  { name: "email", label: "邮箱（可空）", kind: "text" },
  { name: "github", label: "GitHub 用户名（可空）", kind: "text" },
  { name: "location", label: "所在地（可空）", kind: "localized" },
];

export default async function ResumeAdminPage() {
  await requireAdminPage();

  const [profile] = await db
    .select()
    .from(resumeProfiles)
    .where(eq(resumeProfiles.key, "main"))
    .limit(1);
  const rows = await db
    .select()
    .from(resumeExperiences)
    .orderBy(asc(resumeExperiences.sort), asc(resumeExperiences.key));

  const blank: ExperienceDraft = {
    key: "",
    company: { zh: "", en: "" },
    role: { zh: "", en: "" },
    period: { zh: "", en: "" },
    url: null,
    bullets: { zh: [], en: [] },
    sort: (rows.at(-1)?.sort ?? -1) + 1,
  };

  return (
    <AdminChrome title="简历页">
      <p className="mb-8 max-w-[70ch] text-caption text-fg-tertiary">
        <code>/resume</code> 的内容：上面是页首的个人信息，下面一条条是工作经历。
        时间段是原样显示的文字——写成什么样，页面就显示什么样，不做日期运算。
      </p>

      <section>
        <h2 className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          个人信息
        </h2>
        <div className="mt-3">
          <RecordForm
            action={saveResumeProfile}
            fields={PROFILE_FIELDS}
            record={
              profile ?? {
                name: { zh: "", en: "" },
                tagline: { zh: "", en: "" },
                intro: { zh: [], en: [] },
                email: "",
                github: "",
                location: { zh: "", en: "" },
              }
            }
          />
        </div>
      </section>

      <div className="mt-12 space-y-12">
        {rows.map((experience) => (
          <section key={experience.key}>
            <h2 className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
              {experience.key}
            </h2>
            <div className="mt-3">
              <ExperienceForm isNew={false} experience={experience} />
            </div>
          </section>
        ))}

        <section className="border-t border-line pt-8">
          <h2 className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
            新经历
          </h2>
          <div className="mt-3">
            <ExperienceForm isNew experience={blank} />
          </div>
        </section>
      </div>
    </AdminChrome>
  );
}
