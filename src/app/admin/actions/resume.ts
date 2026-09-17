"use server";

import { eq } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { adminSession, requireAdmin } from "@/lib/auth/session";
import {
  intField,
  localized,
  localizedLines,
  raw,
  str,
  validGithubUser,
  validKey,
  validLink,
} from "@/lib/forms";
import { parseProjects, parseSkillLines } from "@/lib/resume";
import { TAGS } from "@/lib/content";
import { invalidate, SESSION_EXPIRED, KEY_ERROR, linkError, upsertKeyed, type ActionState } from "./shared";

/** One row, key "main" — everything on /resume but the jobs, as one form. */
export async function saveResumeProfile(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const name = localized(form, "name");
  if (!name.zh && !name.en) return { error: "名字至少填一种语言。" };
  name.zh ||= name.en;
  name.en ||= name.zh;

  const location = localized(form, "location");
  const note = localized(form, "note");
  // Both rendered as hrefs on /resume: the links page verbatim, the GitHub
  // name spliced into a github.com path.
  const website = str(form, "website") || null;
  if (website && !validLink(website)) return linkError("链接页");
  const github = str(form, "github") || null;
  if (github && !validGithubUser(github)) {
    return { error: "GitHub 用户名只能用字母、数字和连字符，不带 @ 和网址。" };
  }
  // The prose sections use the projects grammar — `# 标题`, then one
  // paragraph per line — so a paragraph before any heading is a form error
  // the author sees rather than a section with no name.
  const zhSections = parseProjects(raw(form, "sections.zh"));
  if (zhSections.error !== null) return { error: `zh 分节：${zhSections.error}` };
  const enSections = parseProjects(raw(form, "sections.en"));
  if (enSections.error !== null) return { error: `en 分节：${enSections.error}` };

  const row = {
    key: "main",
    name,
    tagline: localized(form, "tagline"),
    sections: { zh: zhSections.projects, en: enSections.projects },
    intro: localizedLines(form, "intro"),
    highlights: localizedLines(form, "highlights"),
    // `name | items` per line — the grammar is in src/lib/resume.ts.
    skills: {
      zh: parseSkillLines(raw(form, "skills.zh")),
      en: parseSkillLines(raw(form, "skills.en")),
    },
    projects: localizedLines(form, "projects"),
    education: localizedLines(form, "education"),
    email: str(form, "email") || null,
    github,
    website,
    location: location.zh || location.en ? location : null,
    note: note.zh || note.en ? note : null,
  };

  await db
    .insert(schema.resumeProfiles)
    .values(row)
    .onConflictDoUpdate({
      target: schema.resumeProfiles.key,
      set: { ...row, updatedAt: new Date() },
    });

  invalidate(TAGS.resume);
  return { ok: true };
}

export async function saveResumeExperience(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;

  const company = localized(form, "company");
  if (!company.zh && !company.en) return { error: "公司名至少填一种语言。" };
  company.zh ||= company.en;
  company.en ||= company.zh;

  // Freeform on purpose — "2021.06 – 至今" is a statement, a date column
  // would be an invention. Same discipline as the timeline.
  const period = localized(form, "period");
  if (!period.zh && !period.en) return { error: "时间段至少填一种语言。" };
  period.zh ||= period.en;
  period.en ||= period.zh;
  const sort = intField(form, "sort", "排序", 0);
  if (!sort.ok) return sort;
  const url = str(form, "url") || null;
  if (url && !validLink(url)) return linkError("链接");

  // `# title | period` headings with their bullets beneath — parsed here so
  // a stray line is a form error the author sees, not a project with no name.
  const zhProjects = parseProjects(raw(form, "projects.zh"));
  if (zhProjects.error !== null) return { error: `zh 项目：${zhProjects.error}` };
  const enProjects = parseProjects(raw(form, "projects.en"));
  if (enProjects.error !== null) return { error: `en 项目：${enProjects.error}` };

  const summary = localized(form, "summary");
  const row = {
    key,
    company,
    role: localized(form, "role"),
    period,
    url,
    summary: summary.zh || summary.en ? summary : null,
    bullets: localizedLines(form, "bullets"),
    projects: { zh: zhProjects.projects, en: enProjects.projects },
    sort: sort.value,
  };

  const exists = await upsertKeyed(schema.resumeExperiences, row, Boolean(form.get("isNew")));
  if (exists) return exists;

  invalidate(TAGS.resume);
  return { ok: true };
}

export async function deleteResumeExperience(form: FormData): Promise<void> {
  await requireAdmin();
  const key = str(form, "key");
  if (!key) return;
  await db
    .delete(schema.resumeExperiences)
    .where(eq(schema.resumeExperiences.key, key));
  invalidate(TAGS.resume);
}
