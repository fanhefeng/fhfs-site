"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { adminSession, requireAdmin } from "@/lib/auth/session";
import {
  intField,
  list,
  localized,
  localizedLines,
  parseLocale,
  raw,
  str,
  validDate,
  validGithubUser,
  validKey,
  validLink,
  validPath,
} from "@/lib/forms";
import { renderMarkdown } from "@/lib/markdown";
import { readingMinutes } from "@/lib/reading";
import { parseProjects, parseSkillLines } from "@/lib/resume";
import { TAGS } from "@/lib/content";

/**
 * Every write the admin can make.
 *
 * Two rules hold across all of them.
 *
 * The session check comes first, always. The proxy's check is optimistic
 * and, more to the point, Server Actions are not routes — this file could be
 * moved or the matcher edited and the proxy would simply stop covering it,
 * with nothing failing loudly. An action that reports to a form checks with
 * `adminSession()` and returns `SESSION_EXPIRED`, so an editor whose eight
 * hours ran out mid-article gets a line beside the save button and keeps the
 * text; a throw would have unmounted the form. The delete actions have no
 * form state to report to and nothing typed to lose, so they keep the
 * throwing `requireAdmin()`.
 *
 * `updateTag` comes last, and it is `updateTag` rather than `revalidateTag`.
 * The latter serves the stale copy while it refetches, so the person who just
 * pressed save would be the one person still looking at the old text.
 *
 * How a field is read — what counts as a key, a date, a link — lives in
 * `src/lib/forms.ts`, where it is tested.
 */

function invalidate(...tags: string[]) {
  // `content` is on every getter, so this reaches the pages, the sitemap, the
  // feed and the OG images in one go. The narrower tags are for later, when
  // there is more here than one editor pressing save.
  updateTag(TAGS.content);
  for (const tag of tags) updateTag(tag);
}

export type ActionState = { error?: string; ok?: boolean };

const SESSION_EXPIRED: ActionState = {
  error: "登录已过期。这一页的内容还在——在新标签页重新登录，回来再按一次保存。",
};
const KEY_ERROR: ActionState = { error: "key 只能用小写字母、数字和连字符。" };
const DATE_ERROR: ActionState = {
  error: "日期要写成 YYYY-MM-DD，而且得是真实存在的一天。",
};
const linkError = (label: string): ActionState => ({
  error: `${label}要写完整的 http(s):// 地址，或以单个 / 开头的站内路径。`,
});
const existsError = (key: string): ActionState => ({
  error: `key 已存在：已经有「${key}」了，换一个或去编辑原来那条。`,
});

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export async function savePost(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const slug = str(form, "slug");
  const locale = parseLocale(str(form, "locale"));
  const bodyMd = String(form.get("bodyMd") ?? "");

  if (!validKey(slug)) {
    return { error: "slug 只能用小写字母、数字和连字符。" };
  }
  if (!locale) return { error: "语言只能是 zh 或 en。" };
  if (!str(form, "title")) return { error: "标题不能为空。" };

  const date = str(form, "date");
  if (!validDate(date)) return DATE_ERROR;

  const row = {
    slug,
    locale,
    title: str(form, "title"),
    date,
    summary: str(form, "summary"),
    tags: list(form, "tags"),
    draft: form.get("draft") === "on",
    bodyMd,
    // Rendered once, here, rather than on every read.
    bodyHtml: await renderMarkdown(bodyMd),
    readingMinutes: readingMinutes(bodyMd),
  };

  const isNew = Boolean(form.get("isNew"));
  if (isNew) {
    // A new post must not land on an existing one: the upsert below would
    // silently replace whatever was there, with no way to notice.
    const inserted = await db
      .insert(schema.posts)
      .values(row)
      .onConflictDoNothing({ target: [schema.posts.slug, schema.posts.locale] })
      .returning({ id: schema.posts.id });
    if (!inserted.length) {
      return { error: `slug 已存在：${locale} 下已经有「${slug}」了，换一个或去编辑原文。` };
    }
  } else {
    await db
      .insert(schema.posts)
      .values(row)
      .onConflictDoUpdate({
        target: [schema.posts.slug, schema.posts.locale],
        set: { ...row, updatedAt: new Date() },
      });
  }

  invalidate(TAGS.posts);
  // A first save leaves the "new post" page behind: its props are a blank
  // draft, and React resets the form to props once the action completes.
  if (isNew) redirect(`/admin/posts/${slug}/${locale}`);
  return { ok: true };
}

export async function deletePost(form: FormData): Promise<void> {
  await requireAdmin();
  const slug = str(form, "slug");
  const locale = parseLocale(str(form, "locale"));
  if (!locale) return;
  await db
    .delete(schema.posts)
    .where(and(eq(schema.posts.slug, slug), eq(schema.posts.locale, locale)));
  // A deleted post's page is cached like any other — without this it would go
  // on being served from the edge.
  invalidate(TAGS.posts);
}

// ---------------------------------------------------------------------------
// About
// ---------------------------------------------------------------------------

export async function saveAbout(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const locale = parseLocale(str(form, "locale"));
  if (!locale) return { error: "语言只能是 zh 或 en。" };
  const bodyMd = String(form.get("bodyMd") ?? "");

  const row = {
    locale,
    title: str(form, "title"),
    bodyMd,
    bodyHtml: await renderMarkdown(bodyMd),
  };

  await db
    .insert(schema.abouts)
    .values(row)
    .onConflictDoUpdate({
      target: schema.abouts.locale,
      set: { ...row, updatedAt: new Date() },
    });

  invalidate(TAGS.about);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// Site copy
// ---------------------------------------------------------------------------

/**
 * Saves the copy table in one go — it is edited as one page, because that is
 * how you notice that two lines have to rhyme.
 */
export async function saveCopy(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const rows = await db
    .select({ key: schema.copyBlocks.key })
    .from(schema.copyBlocks);

  const kinetic = str(form, "home.heroKineticWord.zh");
  const enKinetic = str(form, "home.heroKineticWord.en");
  const zhLines = [
    str(form, "home.heroLine1.zh"),
    str(form, "home.heroLine2.zh"),
    str(form, "home.heroSub.zh"),
  ].join(" ");
  const enLines = [
    str(form, "home.heroLine1.en"),
    str(form, "home.heroLine2.en"),
    str(form, "home.heroSub.en"),
  ].join(" ");

  // The home page looks for this word inside the three hero lines to attach
  // the light-up animation. No match, no animation — and nothing would say so.
  if (kinetic && !zhLines.includes(kinetic)) {
    return { error: `中文 hero 里找不到「${kinetic}」，插电动画会失效。` };
  }
  if (enKinetic && !enLines.includes(enKinetic)) {
    return { error: `English hero does not contain "${enKinetic}" — the light-up animation would not run.` };
  }

  // One statement, not sixty-seven. The HTTP driver spends a round trip per
  // query, so updating each row separately turned a save into a wait long
  // enough to wonder whether the button had worked.
  //
  // Only rows the form actually carries: a key added to the table after the
  // page was opened would otherwise be overwritten with two empty strings.
  const values = rows
    .filter(({ key }) => form.has(`${key}.zh`) && form.has(`${key}.en`))
    .map(
      ({ key }) => sql`(${key}, ${raw(form, `${key}.zh`)}, ${raw(form, `${key}.en`)})`
    );
  if (values.length) {
    await db.execute(sql`
      UPDATE copy_blocks AS c
      SET zh = v.zh, en = v.en
      FROM (VALUES ${sql.join(values, sql`, `)}) AS v(key, zh, en)
      WHERE c.key = v.key
    `);
  }

  invalidate(TAGS.copy);
  return { ok: true };
}

// ---------------------------------------------------------------------------
// The structured lists
// ---------------------------------------------------------------------------

export async function saveTimelineEntry(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;

  const date = str(form, "date");
  const dateLabel = localized(form, "dateLabel");
  const hasLabel = Boolean(dateLabel.zh || dateLabel.en);

  // The column has a CHECK for this, but saying it here means a form error
  // rather than a database one.
  if (!date && !hasLabel) {
    return { error: "日期和占位文字至少要填一个——这一栏不编造日期。" };
  }
  if (date && !validDate(date)) return DATE_ERROR;
  const sort = intField(form, "sort", "排序", 0);
  if (!sort.ok) return sort;

  const row = {
    key,
    version: str(form, "version"),
    date: date || null,
    dateLabel: hasLabel ? dateLabel : null,
    title: localized(form, "title"),
    note: localized(form, "note"),
    sort: sort.value,
  };

  await db
    .insert(schema.timelineEntries)
    .values(row)
    .onConflictDoUpdate({ target: schema.timelineEntries.key, set: row });

  invalidate(TAGS.timeline);
  return { ok: true };
}

export async function saveApp(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;

  const category = str(form, "category");
  if (!["desktop", "tool", "game", "website"].includes(category)) {
    return { error: "分类只能是 desktop / tool / game / website。" };
  }

  // Rendered as the card's outbound link on three pages.
  const website = str(form, "website");
  if (!validLink(website)) return linkError("网址");

  // "owner/name" — src/lib/github.ts builds an API URL out of it, so it has
  // to be exactly two path segments and nothing that could escape them.
  const repo = str(form, "repo") || null;
  if (repo && !/^[\w.-]+\/[\w.-]+$/.test(repo)) {
    return { error: "仓库要写成 owner/name，比如 fanhefeng/fhfs-site。" };
  }

  const hue = intField(form, "hue", "色相", null);
  if (!hue.ok) return hue;
  const sort = intField(form, "sort", "排序", 0);
  if (!sort.ok) return sort;

  const row = {
    key,
    name: str(form, "name"),
    tagline: localized(form, "tagline"),
    description: localized(form, "description"),
    category: category as "desktop" | "tool" | "game" | "website",
    website,
    repo,
    platforms: list(form, "platforms"),
    accent: str(form, "accent") || null,
    hue: hue.value,
    sort: sort.value,
  };

  if (form.get("isNew")) {
    // Same guard as a new post: the "new app" form must not overwrite one
    // that already has this key.
    const inserted = await db
      .insert(schema.apps)
      .values(row)
      .onConflictDoNothing({ target: schema.apps.key })
      .returning({ id: schema.apps.id });
    if (!inserted.length) return existsError(key);
  } else {
    await db
      .insert(schema.apps)
      .values(row)
      .onConflictDoUpdate({ target: schema.apps.key, set: row });
  }

  invalidate(TAGS.apps);
  return { ok: true };
}

export async function deleteApp(form: FormData): Promise<void> {
  await requireAdmin();
  const key = str(form, "key");
  if (!key) return;
  await db.delete(schema.apps).where(eq(schema.apps.key, key));
  invalidate(TAGS.apps);
}

export async function saveExperiment(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;

  const status = str(form, "status");
  if (!["live", "wip", "planned"].includes(status)) {
    return { error: "状态只能是 live / wip / planned。" };
  }
  const href = str(form, "href") || null;
  if (href && !validLink(href)) return linkError("外链");
  const sort = intField(form, "sort", "排序", 0);
  if (!sort.ok) return sort;

  const row = {
    key,
    name: localized(form, "name"),
    description: localized(form, "description"),
    status: status as "live" | "wip" | "planned",
    accent: str(form, "accent") || null,
    href,
    demo: str(form, "demo") || null,
    sort: sort.value,
  };

  await db
    .insert(schema.experiments)
    .values(row)
    .onConflictDoUpdate({ target: schema.experiments.key, set: row });

  invalidate(TAGS.experiments);
  return { ok: true };
}

/**
 * Chips and nav links are saved as whole lists.
 *
 * Neither has a natural key, both are short and ordered, and both are read as
 * a sequence — so the sequence is what gets edited. Rows arrive numbered by
 * their position in the form; the numbering is thrown away and the order in
 * the list becomes `sort`, which means reordering, adding and removing are all
 * the same operation and none of them can leave a gap behind.
 */
function collectRows(form: FormData, prefix: string): string[] {
  const indices = new Set<string>();
  for (const key of form.keys()) {
    const match = new RegExp(`^${prefix}\\.(\\d+)\\.`).exec(key);
    if (match) indices.add(match[1]);
  }
  return [...indices].sort((a, b) => Number(a) - Number(b));
}

export async function saveChips(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const rows = collectRows(form, "chip")
    .map((i, index) => ({
      label: {
        zh: str(form, `chip.${i}.label.zh`),
        en: str(form, `chip.${i}.label.en`),
      },
      tone: str(form, `chip.${i}.tone`) as "paper" | "ink" | "accent",
      sort: index,
    }))
    // An emptied pair is how a row is deleted — there is no separate button.
    .filter((row) => row.label.zh || row.label.en);

  for (const row of rows) {
    if (!["paper", "ink", "accent"].includes(row.tone)) {
      return { error: "纸色只能是 paper / ink / accent。" };
    }
    // Proper nouns read the same either way, so one side may stand for both.
    row.label.zh ||= row.label.en;
    row.label.en ||= row.label.zh;
  }

  // Delete and insert travel in one `db.batch()` — a single atomic request —
  // so a failed insert cannot leave the table empty. Same contract as
  // scripts/db-import.mts.
  const wipe = db.delete(schema.chips);
  await db.batch(
    rows.length ? [wipe, db.insert(schema.chips).values(rows)] : [wipe]
  );

  invalidate(TAGS.chips);
  return { ok: true };
}

export async function saveNavItems(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const rows = collectRows(form, "nav")
    .map((i, index) => ({
      href: str(form, `nav.${i}.href`),
      labelKey: str(form, `nav.${i}.labelKey`),
      surfaces: ["header", "footer", "fullnav", "sitemap"].filter(
        (surface) => form.get(`nav.${i}.surface.${surface}`) === "on"
      ),
      sort: index,
    }))
    .filter((row) => row.href);

  // The nav is this site's own pages, so a full URL is refused here where a
  // link field elsewhere would take one — see `validPath` for why `//` and
  // a backslash are not paths.
  for (const row of rows) {
    if (!validPath(row.href)) {
      return { error: `路径要以单个 / 开头，且不能含反斜杠：${row.href}` };
    }
    if (!row.labelKey) {
      return { error: `${row.href} 缺少文案 key。` };
    }
  }

  // A label key that neither the catalogues nor copy_blocks knows renders as
  // raw "nav.xxx" in the header of every page — refuse it here instead.
  // `Object.hasOwn`, not `in`: "constructor" is `in` every object.
  const [zhNav, enNav] = await Promise.all(
    (["zh", "en"] as const).map((locale) =>
      import(`../../../messages/${locale}.json`).then(
        (m) => (m.default as { nav?: Record<string, unknown> }).nav ?? {}
      )
    )
  );
  const overrides = new Set(
    (
      await db.select({ key: schema.copyBlocks.key }).from(schema.copyBlocks)
    ).map((row) => row.key)
  );
  for (const row of rows) {
    const known =
      (Object.hasOwn(zhNav, row.labelKey) && Object.hasOwn(enNav, row.labelKey)) ||
      overrides.has(`nav.${row.labelKey}`);
    if (!known) {
      return {
        error: `文案 key 不存在：nav.${row.labelKey} 在语言文件和站点文案里都找不到。`,
      };
    }
  }

  // Atomic for the same reason as saveChips — an empty nav_items is a site
  // with no header.
  const wipe = db.delete(schema.navItems);
  await db.batch(
    rows.length ? [wipe, db.insert(schema.navItems).values(rows)] : [wipe]
  );

  invalidate(TAGS.nav);
  return { ok: true };
}

export async function saveWork(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;
  const year = intField(form, "year", "年份", null);
  if (!year.ok) return year;
  if (year.value === null || year.value < 1990 || year.value > 2100) {
    return { error: "年份填个四位数。" };
  }
  const sort = intField(form, "sort", "排序", 0);
  if (!sort.ok) return sort;
  const url = str(form, "url") || null;
  if (url && !validLink(url)) return linkError("链接");
  const cover = str(form, "cover") || null;
  if (cover && !validLink(cover)) return linkError("封面路径");

  const row = {
    key,
    title: localized(form, "title"),
    description: localized(form, "description"),
    year: year.value,
    cover,
    url,
    tags: list(form, "tags"),
    accent: str(form, "accent") || null,
    sort: sort.value,
  };

  if (form.get("isNew")) {
    // The "new work" form must not overwrite one that already has this key.
    const inserted = await db
      .insert(schema.works)
      .values(row)
      .onConflictDoNothing({ target: schema.works.key })
      .returning({ id: schema.works.id });
    if (!inserted.length) return existsError(key);
  } else {
    await db
      .insert(schema.works)
      .values(row)
      .onConflictDoUpdate({ target: schema.works.key, set: row });
  }

  invalidate(TAGS.works);
  return { ok: true };
}

export async function deleteWork(form: FormData): Promise<void> {
  await requireAdmin();
  const key = str(form, "key");
  if (!key) return;
  await db.delete(schema.works).where(eq(schema.works.key, key));
  invalidate(TAGS.works);
}

// ---------------------------------------------------------------------------
// Resume
// ---------------------------------------------------------------------------

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
  const row = {
    key: "main",
    name,
    tagline: localized(form, "tagline"),
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

  if (form.get("isNew")) {
    // The "new experience" form must not overwrite a job that has this key.
    const inserted = await db
      .insert(schema.resumeExperiences)
      .values(row)
      .onConflictDoNothing({ target: schema.resumeExperiences.key })
      .returning({ id: schema.resumeExperiences.id });
    if (!inserted.length) return existsError(key);
  } else {
    await db
      .insert(schema.resumeExperiences)
      .values(row)
      .onConflictDoUpdate({ target: schema.resumeExperiences.key, set: row });
  }

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

export async function saveIntroNode(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  if (!(await adminSession())) return SESSION_EXPIRED;

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;

  const period = localized(form, "period");
  const sort = intField(form, "sort", "排序", 0);
  if (!sort.ok) return sort;

  const row = {
    key,
    kicker: localized(form, "kicker"),
    title: localized(form, "title"),
    period: period.zh || period.en ? period : null,
    body: localized(form, "body"),
    bullets: localizedLines(form, "bullets"),
    stickerLabel: str(form, "stickerLabel"),
    stickerIcon: str(form, "stickerIcon"),
    sort: sort.value,
  };

  await db
    .insert(schema.introNodes)
    .values(row)
    .onConflictDoUpdate({ target: schema.introNodes.key, set: row });

  invalidate(TAGS.intro);
  return { ok: true };
}
