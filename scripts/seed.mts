/**
 * Seeds the database from the files that used to *be* the database.
 *
 * Nothing here is transcribed by hand. Prose and YAML are read from
 * `content/`, copy is read from `messages/`, and the constants that were
 * hard-coded inside components are lifted out of their source files as
 * literals (see `extractLiteral`). That matters because several of these
 * things only existed as a *pair* — a constant in one file and two message
 * keys in two others, with nothing to catch a missed edit. Merging them is
 * the whole point of the migration, so the merge happens here, once, against
 * the real sources.
 *
 * Building the rows and writing them are separate passes, so `--dry-run`
 * exercises every bit of parsing and merging without a database.
 *
 * Idempotent: rows with a natural key are upserted, keyless tables are
 * replaced wholesale. Running it twice leaves the same database.
 *
 *   pnpm db:seed
 *   pnpm db:seed --dry-run
 */
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/neon-http";
import { parse as parseYaml } from "yaml";
import * as schema from "../src/db/schema";
import { INTRO_STICKERS } from "../src/lib/intro/stickers";
import { renderMarkdown } from "../src/lib/markdown";
import { readingMinutes } from "../src/lib/reading";
import { site } from "../src/config/site";

const DRY_RUN = process.argv.includes("--dry-run");

// Nothing has loaded .env.local for us — this runs outside Next.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Fine in CI, where the variables are already in the environment.
}

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (rel: string) => readFile(path.join(ROOT, rel), "utf8");

type Localized = { zh: string; en: string };
type Messages = Record<string, any>;

// ---------------------------------------------------------------------------
// Reading the old sources
// ---------------------------------------------------------------------------

/**
 * Pulls a JS literal out of a source file by the name it is bound to, so the
 * seed reads the same array the component renders rather than a copy of it.
 *
 * The scanner tracks strings, template literals and comments while balancing
 * brackets — necessary because these constants contain URLs (`https://`, which
 * would otherwise read as a line comment) and explanatory comments of their
 * own. What comes out is a literal, evaluated as one.
 */
function extractLiteral<T>(source: string, name: string): T {
  const match = new RegExp(`const\\s+${name}\\s*(?::[^=]+?)?=\\s*`).exec(source);
  if (!match) throw new Error(`could not find \`const ${name}\` in source`);

  const start = match.index + match[0].length;
  const open = source[start];
  if (open !== "[" && open !== "{") {
    throw new Error(`\`${name}\` is not an array or object literal`);
  }
  const close = open === "[" ? "]" : "}";

  let depth = 0;
  let quote: string | null = null;
  let i = start;

  for (; i < source.length; i++) {
    const ch = source[i];

    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "/" && source[i + 1] === "/") {
      i = source.indexOf("\n", i);
      if (i === -1) break;
      continue;
    }
    if (ch === "/" && source[i + 1] === "*") {
      i = source.indexOf("*/", i) + 1;
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close && --depth === 0) {
      i++;
      break;
    }
  }

  return new Function(`return (${source.slice(start, i)})`)() as T;
}

/** Splits `---` frontmatter off a markdown file. */
function parseFrontmatter(raw: string): { data: any; body: string } {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  if (!match) throw new Error("file has no frontmatter");
  return {
    data: (parseYaml(match[1]) ?? {}) as any,
    body: raw.slice(match[0].length),
  };
}

/** `my-post.zh` → `{ slug, locale }`. The same rule the collections enforced. */
function parseLocaleName(name: string): { slug: string; locale: "zh" | "en" } {
  const match = /^(.+)\.(zh|en)$/.exec(name);
  if (!match) {
    throw new Error(`"${name}" must end with a locale suffix (.zh or .en)`);
  }
  return { slug: match[1], locale: match[2] as "zh" | "en" };
}

/** YAML dates may arrive as Date or string; the column wants a calendar day. */
function toDay(value: unknown): string {
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === "string") return value.slice(0, 10);
  throw new Error(`not a date: ${String(value)}`);
}

async function readYamlDir<T>(rel: string): Promise<{ key: string; data: T }[]> {
  let names: string[];
  try {
    names = await readdir(path.join(ROOT, rel));
  } catch {
    return []; // content/portfolio has never existed on disk.
  }
  const out: { key: string; data: T }[] = [];
  for (const name of names.filter((n) => n.endsWith(".yaml")).sort()) {
    const raw = await read(path.join(rel, name));
    out.push({ key: name.replace(/\.yaml$/, ""), data: parseYaml(raw) as T });
  }
  return out;
}

async function readMdxDir(rel: string) {
  const names = (await readdir(path.join(ROOT, rel)))
    .filter((n) => n.endsWith(".mdx"))
    .sort();
  return Promise.all(
    names.map(async (name) => ({
      name: name.replace(/\.mdx$/, ""),
      ...parseFrontmatter(await read(path.join(rel, name))),
    }))
  );
}

// ---------------------------------------------------------------------------
// Which message keys are content, and which are chrome
// ---------------------------------------------------------------------------

/**
 * Copy that a person might want to reword: hero lines, the manifesto, section
 * headings, the self-introduction. Everything omitted here — button labels,
 * aria descriptions, plural forms, `nav.*`, `common.*`, `notFound.*` — stays
 * in the JSON catalogues, where next-intl can keep doing ICU on it and where
 * `global-not-found.tsx` can keep importing it statically.
 *
 * The JSON files remain the defaults. Rows written here are an override layer
 * merged on top at request time, so an empty table reads exactly as today.
 */
const COPY_KEYS = [
  "home.issueLabel",
  "home.heroLine1",
  "home.heroLine2",
  "home.heroSub",
  "home.heroKineticWord",
  "home.heroCta",
  "home.slogan",
  "home.sloganEcho",
  "home.latestPosts",
  "home.viewAllPosts",
  "home.featuredWorks",
  "home.viewAllSoftware",
  "home.aboutTitle",
  "home.aboutLead1",
  "home.aboutLead2",
  "home.aboutLink",
  "blog.title",
  "blog.subtitle",
  "blog.empty",
  "about.title",
  "about.subtitle",
  "about.lead",
  "about.keywords",
  "about.stickersTitle",
  "about.stickersHint",
  "about.changelogTitle",
  "about.colophon",
  "about.introTitle",
  "about.introLink",
  "intro.title",
  "intro.subtitle",
  "intro.role",
  "intro.meta",
  "intro.tagline",
  "intro.scrollHint",
  "intro.outroTitle",
  "intro.outroBody",
  "intro.linkAbout",
  "intro.linkWriting",
  "portfolio.kicker",
  "portfolio.title",
  "portfolio.subtitle",
  "portfolio.scrollHint",
  "portfolio.worksTitle",
  "portfolio.visit",
  "portfolio.experimentsTitle",
  "portfolio.experimentsSub",
  "portfolio.openDemo",
  "portfolio.emptyTitle",
  "portfolio.empty",
  "portfolio.emptyCta",
  "portfolio.lens.heading",
  "portfolio.lens.body",
  "portfolio.lens.hint",
  "portfolio.lens.fallback",
  "portfolio.lens.link",
  "software.kicker",
  "software.title",
  "software.subtitle",
  "software.empty",
  "software.deviceTitle",
  "software.deviceSub",
  "footer.colophon",
  "footer.timePrefix",
  "footer.timeSuffix",
  "footer.stickerHint",
  "footer.stickerFallback",
] as const;

/** Notes to self about strings that are load-bearing beyond their words. */
const COPY_NOTES: Record<string, string> = {
  "home.heroKineticWord":
    "Must appear verbatim inside heroLine1, heroLine2 or heroSub — HomeHero looks for it to attach the light-up animation. No match, no animation.",
  "home.heroSub":
    "Deliberately in the other language from the two hero lines above it.",
  "home.sloganEcho": "Always the echo of home.slogan in the other language.",
  "footer.timePrefix":
    "Word-order pair with footer.timeSuffix: Chinese puts the city before the clock, English after. Edit the two together.",
  "footer.timeSuffix": "See footer.timePrefix.",
};

function pick(messages: Messages, key: string): string {
  const value = key.split(".").reduce<any>((acc, part) => acc?.[part], messages);
  if (typeof value !== "string") {
    throw new Error(`message key "${key}" is missing or not a string`);
  }
  return value;
}

// ---------------------------------------------------------------------------
// Pass 1 — build every row from the old sources
// ---------------------------------------------------------------------------

type CraftEntry = {
  id: string;
  status: "live" | "wip" | "planned";
  accent?: string;
  href?: string;
  demo?: string;
};
type Chip = { label: string | Localized; tone?: "ink" | "accent" };
type NavConst = readonly { href: string; key: string }[];

async function buildPlan() {
  const zh: Messages = JSON.parse(await read("messages/zh.json"));
  const en: Messages = JSON.parse(await read("messages/en.json"));
  const both = (key: string): Localized => ({
    zh: pick(zh, key),
    en: pick(en, key),
  });

  // -- posts, abouts -------------------------------------------------------
  const posts = await Promise.all(
    (await readMdxDir("content/blog")).map(async ({ name, data, body }) => {
      const { slug, locale } = parseLocaleName(name);
      return {
        slug,
        locale,
        title: String(data.title),
        date: toDay(data.date),
        summary: String(data.summary),
        tags: (data.tags ?? []) as string[],
        draft: Boolean(data.draft ?? false),
        cover: data.cover ? String(data.cover) : null,
        bodyMd: body,
        bodyHtml: await renderMarkdown(body),
        readingMinutes: readingMinutes(body),
      };
    })
  );

  const abouts = await Promise.all(
    (await readMdxDir("content/about")).map(async ({ name, data, body }) => ({
      locale: parseLocaleName(name).locale,
      title: String(data.title),
      bodyMd: body,
      bodyHtml: await renderMarkdown(body),
    }))
  );

  // -- timeline ------------------------------------------------------------
  const timeline = (await readYamlDir<any>("content/about/timeline")).map(
    ({ key, data }) => ({
      key,
      version: String(data.version),
      date: data.date ? toDay(data.date) : null,
      dateLabel: (data.dateLabel ?? null) as Localized | null,
      title: data.title as Localized,
      note: data.note as Localized,
      sort: Number(data.order),
    })
  );

  // -- apps ----------------------------------------------------------------
  // Two colour systems used to describe the same app: the portfolio page kept
  // a hex lookup table, the software page derived a hue from array position.
  // Both fold into columns here so an app has one colour, wherever it appears.
  const portfolioSource = await read("src/app/[locale]/portfolio/page.tsx");
  const appAccent = extractLiteral<Record<string, string>>(
    portfolioSource,
    "APP_ACCENT"
  );
  const hues = extractLiteral<number[]>(
    await read("src/components/software/appMeta.ts"),
    "HUES"
  );

  const apps = (await readYamlDir<any>("content/software"))
    .sort((a, b) => (a.data.order ?? 0) - (b.data.order ?? 0))
    .map(({ key, data }, index) => ({
      key,
      name: String(data.name),
      tagline: data.tagline as Localized,
      description: data.description as Localized,
      category: data.category as "desktop" | "tool" | "game" | "website",
      icon: data.icon ? String(data.icon) : null,
      website: String(data.website),
      platforms: (data.platforms ?? []) as string[],
      accent: appAccent[key] ?? null,
      // Position-derived today; stored so reordering stops repainting the page.
      hue: hues[index % hues.length],
      sort: Number(data.order ?? 0),
    }));

  // -- works ---------------------------------------------------------------
  const works = (await readYamlDir<any>("content/portfolio")).map(
    ({ key, data }) => ({
      key,
      title: data.title as Localized,
      description: data.description as Localized,
      year: Number(data.year),
      cover: data.cover ? String(data.cover) : null,
      url: data.url ? String(data.url) : null,
      tags: (data.tags ?? []) as string[],
      sort: Number(data.order ?? 0),
    })
  );

  // -- experiments ---------------------------------------------------------
  const craft = extractLiteral<CraftEntry[]>(portfolioSource, "CRAFT_ENTRIES");
  const experiments = craft.map((entry, index) => ({
    key: entry.id,
    name: both(`portfolio.experiments.${entry.id}.name`),
    description: both(`portfolio.experiments.${entry.id}.desc`),
    status: entry.status,
    accent: entry.accent ?? null,
    href: entry.href ?? null,
    demo: entry.demo ?? null,
    sort: index,
  }));

  // -- intro nodes ---------------------------------------------------------
  // Copy lived in messages, the sticker's label and icon in stickers.ts, and
  // the two were joined by an id nothing type-checked. They join here instead.
  const introNodes = INTRO_STICKERS.map((sticker, index) => ({
    key: sticker.id,
    kicker: both(`intro.nodes.${sticker.id}.kicker`),
    title: both(`intro.nodes.${sticker.id}.title`),
    period: null,
    body: both(`intro.nodes.${sticker.id}.body`),
    bullets: {
      zh: (zh.intro.nodes[sticker.id]?.bullets ?? []) as string[],
      en: (en.intro.nodes[sticker.id]?.bullets ?? []) as string[],
    },
    stickerLabel: sticker.label,
    stickerIcon: sticker.icon,
    sort: index,
  }));

  // -- chips ---------------------------------------------------------------
  // `label` was `string | { zh, en }` — proper nouns read the same either way.
  const chips = extractLiteral<Chip[]>(
    await read("src/components/about/StickerWall.tsx"),
    "CHIPS"
  ).map((chip, index) => ({
    label:
      typeof chip.label === "string"
        ? { zh: chip.label, en: chip.label }
        : chip.label,
    tone: chip.tone ?? ("paper" as const),
    sort: index,
  }));

  // -- nav -----------------------------------------------------------------
  // Four lists that had already drifted apart: /intro only ever reached the
  // sitemap, and home only ever reached the full-screen menu.
  const header = extractLiteral<NavConst>(
    await read("src/components/layout/Header.tsx"),
    "NAV_ITEMS"
  );
  const footer = extractLiteral<NavConst>(
    await read("src/components/layout/Footer.tsx"),
    "NAV_ITEMS"
  );
  const fullNav = extractLiteral<NavConst>(
    await read("src/components/layout/FullNav.tsx"),
    "ITEMS"
  );
  const sitemapPaths = extractLiteral<string[]>(
    await read("src/app/sitemap.ts"),
    "staticPaths"
  );

  // Ordered as the sitemap listed them: home, blog, about, intro, portfolio,
  // software. `nav.intro` has no label in the catalogues because /intro is
  // reached from the about page rather than the menu — it is sitemap-only.
  const navItems = sitemapPaths.map((p, index) => {
    const href = p === "" ? "/" : p;
    const on: string[] = [];
    if (header.some((i) => i.href === href)) on.push("header");
    if (footer.some((i) => i.href === href)) on.push("footer");
    if (fullNav.some((i) => i.href === href)) on.push("fullnav");
    on.push("sitemap");
    return {
      href,
      labelKey: href === "/" ? "home" : href.slice(1),
      surfaces: on,
      sort: index,
    };
  });

  // -- copy blocks, site settings ------------------------------------------
  const copyBlocks = COPY_KEYS.map((key) => ({
    key,
    zh: pick(zh, key),
    en: pick(en, key),
    note: COPY_NOTES[key] ?? null,
  }));

  const siteSettings = {
    id: 1,
    signName: site.signName,
    title: site.title as Localized,
    description: site.description as Localized,
    url: site.url,
    author: site.author,
    // `email: ""` is meaningful, not a to-do: PeelSticker branches on it.
    social: { github: site.social.github, email: site.social.email },
  };

  // -- the implicit foreign keys, checked out loud for the first time ------
  assertSameSet(
    "intro nodes",
    new Set(INTRO_STICKERS.map((s) => s.id)),
    new Set(Object.keys(zh.intro.nodes))
  );
  assertSameSet(
    "portfolio experiments",
    new Set(craft.map((c) => c.id)),
    new Set(Object.keys(zh.portfolio.experiments))
  );
  for (const entry of timeline) {
    if (!entry.date && !entry.dateLabel) {
      throw new Error(
        `timeline "${entry.key}" has neither a date nor a dateLabel`
      );
    }
  }

  return {
    posts,
    abouts,
    timeline,
    apps,
    works,
    experiments,
    introNodes,
    chips,
    navItems,
    copyBlocks,
    siteSettings,
  };
}

function assertSameSet(what: string, a: Set<string>, b: Set<string>) {
  const onlyA = [...a].filter((k) => !b.has(k));
  const onlyB = [...b].filter((k) => !a.has(k));
  if (onlyA.length || onlyB.length) {
    throw new Error(
      `${what}: key sets disagree — only in structure: [${onlyA}], only in copy: [${onlyB}]`
    );
  }
}

// ---------------------------------------------------------------------------
// Pass 2 — write
// ---------------------------------------------------------------------------

async function write(plan: Awaited<ReturnType<typeof buildPlan>>) {
  // Migrations and bulk writes go through the unpooled connection: PgBouncer
  // breaks the prepared statements these depend on.
  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL_UNPOOLED (preferred) or DATABASE_URL must be set. " +
        "Copy the connection strings out of the Neon dashboard into .env.local."
    );
  }
  const db = drizzle(url, { schema });

  for (const row of plan.posts) {
    await db
      .insert(schema.posts)
      .values(row)
      .onConflictDoUpdate({
        target: [schema.posts.slug, schema.posts.locale],
        set: { ...row, updatedAt: new Date() },
      });
  }

  for (const row of plan.abouts) {
    await db
      .insert(schema.abouts)
      .values(row)
      .onConflictDoUpdate({
        target: schema.abouts.locale,
        set: { ...row, updatedAt: new Date() },
      });
  }

  for (const row of plan.timeline) {
    await db
      .insert(schema.timelineEntries)
      .values(row)
      .onConflictDoUpdate({ target: schema.timelineEntries.key, set: row });
  }

  for (const row of plan.apps) {
    await db
      .insert(schema.apps)
      .values(row)
      .onConflictDoUpdate({ target: schema.apps.key, set: row });
  }

  for (const row of plan.works) {
    await db
      .insert(schema.works)
      .values(row)
      .onConflictDoUpdate({ target: schema.works.key, set: row });
  }

  for (const row of plan.experiments) {
    await db
      .insert(schema.experiments)
      .values(row)
      .onConflictDoUpdate({ target: schema.experiments.key, set: row });
  }

  for (const row of plan.introNodes) {
    await db
      .insert(schema.introNodes)
      .values(row)
      .onConflictDoUpdate({ target: schema.introNodes.key, set: row });
  }

  // Keyless tables: replaced wholesale, which is still idempotent.
  await db.delete(schema.chips);
  if (plan.chips.length) await db.insert(schema.chips).values(plan.chips);

  await db.delete(schema.navItems);
  if (plan.navItems.length)
    await db.insert(schema.navItems).values(plan.navItems);

  await db.delete(schema.copyBlocks);
  if (plan.copyBlocks.length)
    await db.insert(schema.copyBlocks).values(plan.copyBlocks);

  await db
    .insert(schema.siteSettings)
    .values(plan.siteSettings)
    .onConflictDoUpdate({
      target: schema.siteSettings.id,
      set: plan.siteSettings,
    });
}

// ---------------------------------------------------------------------------

const plan = await buildPlan();

const counts: [string, number][] = [
  ["posts", plan.posts.length],
  ["abouts", plan.abouts.length],
  ["timeline_entries", plan.timeline.length],
  ["apps", plan.apps.length],
  ["works", plan.works.length],
  ["experiments", plan.experiments.length],
  ["intro_nodes", plan.introNodes.length],
  ["chips", plan.chips.length],
  ["nav_items", plan.navItems.length],
  ["copy_blocks", plan.copyBlocks.length],
  ["site_settings", 1],
];
for (const [name, n] of counts) console.log(`${name.padEnd(17)}${n}`);

if (DRY_RUN) {
  // The merged tables are the ones worth eyeballing: everything else is a
  // straight copy of a file, but these were assembled from two or four
  // sources that nothing previously kept in agreement.
  console.log("\nnav_items (four lists merged)");
  for (const item of plan.navItems) {
    console.log(`  ${item.href.padEnd(11)} ${item.surfaces.join(", ")}`);
  }

  console.log("\nexperiments (constant + copy)");
  for (const e of plan.experiments) {
    console.log(`  ${e.key.padEnd(15)} ${e.status.padEnd(8)} ${e.name.zh}`);
  }

  console.log("\napps (colour columns folded in)");
  for (const a of plan.apps) {
    console.log(
      `  ${a.key.padEnd(15)} ${(a.accent ?? "—").padEnd(8)} hue ${a.hue}`
    );
  }

  console.log("\nposts");
  for (const p of plan.posts) {
    console.log(
      `  ${p.date}  ${p.locale}  ${p.readingMinutes}min  ` +
        `${p.slug.padEnd(28)} [${p.tags.join(", ")}]`
    );
  }

  console.log("\ndry run — nothing written");
} else {
  await write(plan);
  console.log("\nseed complete");
}
