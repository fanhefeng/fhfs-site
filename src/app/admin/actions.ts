"use server";

import { updateTag } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import * as schema from "@/db/schema";
import { requireAdmin } from "@/lib/auth/session";
import { renderMarkdown } from "@/lib/markdown";
import { readingMinutes } from "@/lib/reading";
import { TAGS } from "@/lib/content";

/**
 * Every write the admin can make.
 *
 * Two rules hold across all of them.
 *
 * `requireAdmin()` comes first, always. The proxy's check is optimistic and,
 * more to the point, Server Actions are not routes — this file could be moved
 * or the matcher edited and the proxy would simply stop covering it, with
 * nothing failing loudly.
 *
 * `updateTag` comes last, and it is `updateTag` rather than `revalidateTag`.
 * The latter serves the stale copy while it refetches, so the person who just
 * pressed save would be the one person still looking at the old text.
 */

function invalidate(...tags: string[]) {
  // `content` is on every getter, so this reaches the pages, the sitemap, the
  // feed and the OG images in one go. The narrower tags are for later, when
  // there is more here than one editor pressing save.
  updateTag(TAGS.content);
  for (const tag of tags) updateTag(tag);
}

const str = (form: FormData, key: string) => String(form.get(key) ?? "").trim();

/**
 * Verbatim, including leading and trailing spaces.
 *
 * Copy has to be read this way. `footer.timePrefix` is `"青岛 · "` and
 * `timeSuffix` is `" in Qingdao"` — the two of them bracket a clock, and which
 * side the city sits on differs by language. Trimming them silently closes the
 * gap, and nothing downstream notices: the markup still renders, HTML collapses
 * the whitespace, and the line just reads slightly wrong forever.
 */
const raw = (form: FormData, key: string) => String(form.get(key) ?? "");

/** Narrows to the locale union — excluding literals off `string` does not. */
const parseLocale = (value: string): "zh" | "en" | null =>
  value === "zh" || value === "en" ? value : null;

const localized = (form: FormData, key: string) => ({
  zh: str(form, `${key}.zh`),
  en: str(form, `${key}.en`),
});

/** Shared by every keyed table — an empty key would upsert a "" row forever.
 *  Post slugs obey the same grammar (they become URLs), with their own
 *  error text. */
const validKey = (key: string) => /^[a-z0-9][a-z0-9-]*$/.test(key);
const KEY_ERROR = { error: "key 只能用小写字母、数字和连字符。" };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DATE_ERROR = { error: "日期要写成 YYYY-MM-DD，而且得是真实存在的一天。" };

/** The regex is happy with 2026-02-30; the round trip through `Date` is not
 *  (a date-only ISO string parses as UTC, so it comes back unchanged). */
const validDate = (value: string) => {
  if (!DATE_RE.test(value)) return false;
  const time = Date.parse(value);
  return !Number.isNaN(time) && new Date(time).toISOString().slice(0, 10) === value;
};

export type ActionState = { error?: string; ok?: boolean };

/**
 * `Number(form.get("sort") ?? 0)` looked safe and was not: `Number("abc")` is
 * NaN and `Number("1e400")` is Infinity, and either reaches the integer column
 * as a database error rather than a form one. Empty means `fallback`; anything
 * else has to be a whole number.
 */
function intField<Fallback extends number | null>(
  form: FormData,
  key: string,
  label: string,
  fallback: Fallback
): { ok: true; value: number | Fallback } | { ok: false; error: string } {
  const text = str(form, key);
  if (!text) return { ok: true, value: fallback };
  const n = Number(text);
  if (!Number.isInteger(n)) return { ok: false, error: `${label}要填整数。` };
  return { ok: true, value: n };
}

// ---------------------------------------------------------------------------
// Posts
// ---------------------------------------------------------------------------

export async function savePost(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  await requireAdmin();

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
    tags: str(form, "tags")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
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
  await requireAdmin();

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
  await requireAdmin();

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
  await requireAdmin();

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
  await requireAdmin();

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;

  const category = str(form, "category");
  if (!["desktop", "tool", "game", "website"].includes(category)) {
    return { error: "分类只能是 desktop / tool / game / website。" };
  }

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
    website: str(form, "website"),
    repo,
    platforms: str(form, "platforms")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean),
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
    if (!inserted.length) {
      return { error: `key 已存在：已经有「${key}」了，换一个或去编辑原来那条。` };
    }
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
  await requireAdmin();

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;

  const status = str(form, "status");
  if (!["live", "wip", "planned"].includes(status)) {
    return { error: "状态只能是 live / wip / planned。" };
  }
  const sort = intField(form, "sort", "排序", 0);
  if (!sort.ok) return sort;

  const row = {
    key,
    name: localized(form, "name"),
    description: localized(form, "description"),
    status: status as "live" | "wip" | "planned",
    accent: str(form, "accent") || null,
    href: str(form, "href") || null,
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
  await requireAdmin();

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
  await requireAdmin();

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

  // `//evil.com` also starts with "/" — a browser reads that as
  // protocol-relative and the header would link off-site. So does
  // `/\evil.com`: URL parsing treats a backslash as a slash.
  for (const row of rows) {
    if (
      !row.href.startsWith("/") ||
      row.href.startsWith("//") ||
      row.href.includes("\\")
    ) {
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
  await requireAdmin();

  const key = str(form, "key");
  if (!validKey(key)) return KEY_ERROR;
  const year = intField(form, "year", "年份", null);
  if (!year.ok) return year;
  if (year.value === null || year.value < 1990 || year.value > 2100) {
    return { error: "年份填个四位数。" };
  }
  const sort = intField(form, "sort", "排序", 0);
  if (!sort.ok) return sort;

  const row = {
    key,
    title: localized(form, "title"),
    description: localized(form, "description"),
    year: year.value,
    cover: str(form, "cover") || null,
    url: str(form, "url") || null,
    tags: str(form, "tags")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean),
    accent: str(form, "accent") || null,
    sort: sort.value,
  };

  await db
    .insert(schema.works)
    .values(row)
    .onConflictDoUpdate({ target: schema.works.key, set: row });

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

/** One row, key "main" — the /resume header edits as a single form. */
export async function saveResumeProfile(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  await requireAdmin();

  const name = localized(form, "name");
  if (!name.zh && !name.en) return { error: "名字至少填一种语言。" };
  name.zh ||= name.en;
  name.en ||= name.zh;

  const location = localized(form, "location");
  const row = {
    key: "main",
    name,
    tagline: localized(form, "tagline"),
    intro: {
      zh: String(form.get("intro.zh") ?? "").split("\n").map((p) => p.trim()).filter(Boolean),
      en: String(form.get("intro.en") ?? "").split("\n").map((p) => p.trim()).filter(Boolean),
    },
    email: str(form, "email") || null,
    github: str(form, "github") || null,
    location: location.zh || location.en ? location : null,
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
  await requireAdmin();

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

  const row = {
    key,
    company,
    role: localized(form, "role"),
    period,
    url: str(form, "url") || null,
    bullets: {
      zh: String(form.get("bullets.zh") ?? "").split("\n").map((b) => b.trim()).filter(Boolean),
      en: String(form.get("bullets.en") ?? "").split("\n").map((b) => b.trim()).filter(Boolean),
    },
    sort: sort.value,
  };

  await db
    .insert(schema.resumeExperiences)
    .values(row)
    .onConflictDoUpdate({ target: schema.resumeExperiences.key, set: row });

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
  await requireAdmin();

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
    bullets: {
      zh: String(form.get("bullets.zh") ?? "").split("\n").map((b) => b.trim()).filter(Boolean),
      en: String(form.get("bullets.en") ?? "").split("\n").map((b) => b.trim()).filter(Boolean),
    },
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
