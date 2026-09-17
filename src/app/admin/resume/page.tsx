import { asc, eq } from "drizzle-orm";
import { db } from "@/db";
import { resumeExperiences, resumeProfiles } from "@/db/schema";
import { requireAdminPage } from "@/lib/auth/session";
import { formatProjects, formatSkillLine } from "@/lib/resume";
import { AdminChrome } from "../AdminChrome";
import { RecordForm, type Field } from "../RecordForm";
import { saveResumeProfile } from "../actions/resume";
import { ExperienceForm, type ExperienceDraft } from "./ExperienceForm";
import { Note } from "../ui/Note";
import { cardClass, metaClass } from "../styles";

const INLINE_HINT = "一行一条。**粗体** 和 `代码` 会按样式渲染，其余原样。";

const PROFILE_FIELDS: Field[] = [
  { name: "name", label: "名字", kind: "localized" },
  { name: "tagline", label: "一句话（角色/定位）", kind: "localized" },
  {
    name: "sections",
    label: "分节正文",
    kind: "lines",
    rows: 24,
    group: "正文各节",
    hint: "页面的主体，显示在个人信息之后、其余各节之前。以「# 标题」起一节（我是谁 / 我做过什么 / 我怎么工作……），下面一行一段，节之间空一行。段落里 **粗体** 和 `代码` 会按样式渲染。",
  },
  {
    name: "intro",
    label: "概述（可空）",
    kind: "lines",
    group: "正文各节",
    hint: "一行一段，空行忽略。有分节正文时通常留空。",
  },
  {
    name: "highlights",
    label: "概述下的要点",
    kind: "lines",
    hint: INLINE_HINT,
    group: "正文各节",
  },
  {
    name: "skills",
    label: "技能表",
    kind: "lines",
    group: "正文各节",
    hint: "一行一组，写成「方向 | 内容」：竖线前是左栏的小标题，没有竖线就只显示内容。",
  },
  { name: "projects", label: "开源与项目", kind: "lines", hint: INLINE_HINT, group: "正文各节" },
  { name: "education", label: "教育背景", kind: "lines", hint: "一行一条。", group: "正文各节" },
  {
    name: "email",
    label: "邮箱（可空）",
    kind: "text",
    group: "联系方式",
    hint: "这一页是公开的——留空就不显示，页脚贴纸下的邮箱不受影响。",
  },
  { name: "github", label: "GitHub 用户名（可空）", kind: "text", group: "联系方式" },
  {
    name: "website",
    label: "链接页（可空）",
    kind: "text",
    group: "联系方式",
    hint: "Linktree 之类的个人链接页，写完整地址，如 https://linktr.ee/xxx。",
  },
  { name: "location", label: "所在地（可空）", kind: "localized", group: "联系方式" },
  {
    name: "note",
    label: "备注一句（可空，显示在联系方式那一行的末尾）",
    kind: "localized",
    group: "联系方式",
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
  // already written out in its `name | items` grammar, one group per line,
  // and the sections in the `# 标题` grammar, split back into lines for the
  // textarea to join.
  const record = profile
    ? {
        ...profile,
        sections: {
          zh: formatProjects(profile.sections.zh).split("\n"),
          en: formatProjects(profile.sections.en).split("\n"),
        },
        skills: {
          zh: profile.skills.zh.map(formatSkillLine),
          en: profile.skills.en.map(formatSkillLine),
        },
      }
    : {
        name: { zh: "", en: "" },
        tagline: { zh: "", en: "" },
        sections: { zh: [], en: [] },
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
    <AdminChrome title="简历页" section="/admin/resume">
      <Note>
        这一页是公开的，电话、邮箱、具体公司名这类信息请自行斟酌。时间段是原样显示的文字——
        写成什么样页面就显示什么样，不做日期运算；经历留空要点和项目，就只列公司、职位和时间段一行。
      </Note>

      <section className={`${cardClass} p-5 sm:p-6`}>
        <h2 className={metaClass}>个人信息</h2>
        <div className="mt-4">
          <RecordForm action={saveResumeProfile} fields={PROFILE_FIELDS} record={record} />
        </div>
      </section>

      <h2 className={`${metaClass} mt-10 border-b border-line pb-2`}>工作经历</h2>
      <div className="mt-4 space-y-6">
        {rows.map((experience) => (
          <section key={experience.key} className={`${cardClass} p-5 sm:p-6`}>
            <h3 className={metaClass}>{experience.key}</h3>
            <div className="mt-4">
              <ExperienceForm isNew={false} experience={experience} />
            </div>
          </section>
        ))}

        <section className={`${cardClass} p-5 sm:p-6`}>
          <h3 className={metaClass}>新经历</h3>
          <div className="mt-4">
            <ExperienceForm isNew experience={blank} />
          </div>
        </section>
      </div>
    </AdminChrome>
  );
}
