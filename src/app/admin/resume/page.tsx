import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { resumeExperiences, resumeProfiles } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
import { formatSkillLine } from "@/lib/resume";
import { AdminChrome } from "../AdminChrome";
import { RecordForm, type Field } from "../RecordForm";
import { saveResumeProfile } from "../actions";
import { ExperienceForm, type ExperienceDraft } from "./ExperienceForm";

const INLINE_HINT = "一行一条。**粗体** 和 `代码` 会按样式渲染，其余原样。";

const PROFILE_FIELDS: Field[] = [
  { name: "name", label: "名字", kind: "localized" },
  { name: "tagline", label: "一句话（角色/定位）", kind: "localized" },
  {
    name: "intro",
    label: "概述",
    kind: "lines",
    hint: "一行一段，空行忽略。",
  },
  { name: "highlights", label: "概述下的要点", kind: "lines", hint: INLINE_HINT },
  {
    name: "skills",
    label: "技能表",
    kind: "lines",
    hint: "一行一组，写成「方向 | 内容」：竖线前是左栏的小标题，没有竖线就只显示内容。",
  },
  { name: "projects", label: "开源与项目", kind: "lines", hint: INLINE_HINT },
  { name: "education", label: "教育背景", kind: "lines", hint: "一行一条。" },
  {
    name: "email",
    label: "邮箱（可空）",
    kind: "text",
    hint: "这一页是公开的——留空就不显示，页脚贴纸下的邮箱不受影响。",
  },
  { name: "github", label: "GitHub 用户名（可空）", kind: "text" },
  {
    name: "website",
    label: "链接页（可空）",
    kind: "text",
    hint: "Linktree 之类的个人链接页，写完整地址，如 https://linktr.ee/xxx。",
  },
  { name: "location", label: "所在地（可空）", kind: "localized" },
  {
    name: "note",
    label: "备注一句（可空，显示在联系方式那一行的末尾）",
    kind: "localized",
  },
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
    summary: null,
    bullets: { zh: [], en: [] },
    projects: { zh: [], en: [] },
    sort: (rows.at(-1)?.sort ?? -1) + 1,
  };

  // The form edits lists as textareas, so the skills table is handed over
  // already written out in its `name | items` grammar, one group per line.
  const record = profile
    ? {
        ...profile,
        skills: {
          zh: profile.skills.zh.map(formatSkillLine),
          en: profile.skills.en.map(formatSkillLine),
        },
      }
    : {
        name: { zh: "", en: "" },
        tagline: { zh: "", en: "" },
        intro: { zh: [], en: [] },
        highlights: { zh: [], en: [] },
        skills: { zh: [], en: [] },
        projects: { zh: [], en: [] },
        education: { zh: [], en: [] },
        email: "",
        github: "",
        website: "",
        location: { zh: "", en: "" },
        note: { zh: "", en: "" },
      };

  return (
    <AdminChrome title="简历页">
      <p className="mb-8 max-w-[70ch] text-caption text-fg-tertiary">
        <code>/resume</code> 的内容：上面是个人信息、概述、技能、开源与教育，下面一条条是工作经历。
        时间段是原样显示的文字——写成什么样，页面就显示什么样，不做日期运算。
        这一页是公开的，电话、邮箱、具体公司名这类信息请自行斟酌。
      </p>

      <section>
        <h2 className="font-mono text-meta uppercase tracking-meta text-fg-tertiary">
          个人信息
        </h2>
        <div className="mt-3">
          <RecordForm
            action={saveResumeProfile}
            fields={PROFILE_FIELDS}
            record={record}
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
