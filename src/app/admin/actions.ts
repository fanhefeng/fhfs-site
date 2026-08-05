"use server";

import { updateTag } from "next/cache";
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

export type ActionState = { error?: string; ok?: boolean };

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

  if (!/^[a-z0-9][a-z0-9-]*$/.test(slug)) {
    return { error: "slug 只能用小写字母、数字和连字符。" };
  }
  if (!locale) return { error: "语言只能是 zh 或 en。" };
  if (!str(form, "title")) return { error: "标题不能为空。" };

  const date = str(form, "date");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "日期要写成 YYYY-MM-DD。" };
  }

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
    cover: null,
    bodyMd,
    // Rendered once, here, rather than on every read.
    bodyHtml: await renderMarkdown(bodyMd),
    readingMinutes: readingMinutes(bodyMd),
  };

  await db
    .insert(schema.posts)
    .values(row)
    .onConflictDoUpdate({
      target: [schema.posts.slug, schema.posts.locale],
      set: { ...row, updatedAt: new Date() },
    });

  invalidate(TAGS.posts);
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
  const values = rows.map(
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

  const date = str(form, "date");
  const dateLabel = localized(form, "dateLabel");
  const hasLabel = Boolean(dateLabel.zh || dateLabel.en);

  // The column has a CHECK for this, but saying it here means a form error
  // rather than a database one.
  if (!date && !hasLabel) {
    return { error: "日期和占位文字至少要填一个——这一栏不编造日期。" };
  }
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { error: "日期要写成 YYYY-MM-DD。" };
  }

  const row = {
    key: str(form, "key"),
    version: str(form, "version"),
    date: date || null,
    dateLabel: hasLabel ? dateLabel : null,
    title: localized(form, "title"),
    note: localized(form, "note"),
    sort: Number(form.get("sort") ?? 0),
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

  const category = str(form, "category");
  if (!["desktop", "tool", "game", "website"].includes(category)) {
    return { error: "分类只能是 desktop / tool / game / website。" };
  }

  const row = {
    key: str(form, "key"),
    name: str(form, "name"),
    tagline: localized(form, "tagline"),
    description: localized(form, "description"),
    category: category as "desktop" | "tool" | "game" | "website",
    icon: null,
    website: str(form, "website"),
    platforms: str(form, "platforms")
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean),
    accent: str(form, "accent") || null,
    hue: form.get("hue") ? Number(form.get("hue")) : null,
    sort: Number(form.get("sort") ?? 0),
  };

  await db
    .insert(schema.apps)
    .values(row)
    .onConflictDoUpdate({ target: schema.apps.key, set: row });

  invalidate(TAGS.apps);
  return { ok: true };
}

export async function saveExperiment(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  await requireAdmin();

  const status = str(form, "status");
  if (!["live", "wip", "planned"].includes(status)) {
    return { error: "状态只能是 live / wip / planned。" };
  }

  const row = {
    key: str(form, "key"),
    name: localized(form, "name"),
    description: localized(form, "description"),
    status: status as "live" | "wip" | "planned",
    accent: str(form, "accent") || null,
    href: str(form, "href") || null,
    demo: str(form, "demo") || null,
    sort: Number(form.get("sort") ?? 0),
  };

  await db
    .insert(schema.experiments)
    .values(row)
    .onConflictDoUpdate({ target: schema.experiments.key, set: row });

  invalidate(TAGS.experiments);
  return { ok: true };
}

export async function saveIntroNode(
  _prev: ActionState,
  form: FormData
): Promise<ActionState> {
  await requireAdmin();

  const period = localized(form, "period");
  const row = {
    key: str(form, "key"),
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
    sort: Number(form.get("sort") ?? 0),
  };

  await db
    .insert(schema.introNodes)
    .values(row)
    .onConflictDoUpdate({ target: schema.introNodes.key, set: row });

  invalidate(TAGS.intro);
  return { ok: true };
}
