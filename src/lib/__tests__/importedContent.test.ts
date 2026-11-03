import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";

const fixture = vi.hoisted(() => ({
  client: undefined as unknown as import("@electric-sql/pglite").PGlite,
}));
vi.mock("@/db", async () => {
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  fixture.client = new PGlite();
  return {
    db: Object.assign(drizzle(fixture.client), {
      batch: (queries: PromiseLike<unknown>[]) => Promise.all(queries),
    }),
  };
});
vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => {
  const entries = new Map<string, { value: unknown; expires: number }>();
  return {
    updateTag: () => entries.clear(),
    unstable_cache:
      (
        read: (...args: unknown[]) => Promise<unknown>,
        keys: string[],
        options: { revalidate: number },
      ) =>
      async (...args: unknown[]) => {
        const key = JSON.stringify([keys, args]);
        const entry = entries.get(key);
        if (entry && entry.expires > Date.now()) return entry.value;
        const value = await read(...args);
        entries.set(key, { value, expires: Date.now() + options.revalidate * 1000 });
        return value;
      },
  };
});
vi.mock("@/lib/server/auth/session", () => ({ showDrafts: async () => false }));

import {
  getAdjacentPosts,
  getAdjacentSecrets,
  getAllTags,
  getPost,
  getPostEditions,
  getPosts,
  getPostsByTag,
  getSecret,
  getSecretEditions,
  getSecrets,
  getSitemapEditions,
} from "@/lib/server/content";
import { updateTag } from "next/cache";
const withContentCacheBypass = <T>(_bypass: boolean, read: () => T): T => read();
import { getNotes } from "@/lib/server/notebook";
import { noteDestination } from "@/lib/notebook";

beforeAll(async () => {
  // An isolated, in-memory database. No environment credentials or external I/O.
  await fixture.client.exec(`
    CREATE TABLE posts (
      id serial PRIMARY KEY, slug text NOT NULL, locale text NOT NULL,
      title text NOT NULL DEFAULT 'Database article', date date NOT NULL DEFAULT '2026-10-01',
      summary text NOT NULL DEFAULT 'Database summary', tags text[] NOT NULL DEFAULT '{}',
      reading_minutes integer NOT NULL DEFAULT 1, body_html text NOT NULL DEFAULT '<p>Database body</p>',
      draft boolean NOT NULL DEFAULT false
    );
    CREATE TABLE secrets (
      id serial PRIMARY KEY, slug text NOT NULL, locale text NOT NULL,
      kind text NOT NULL DEFAULT 'essay', title text NOT NULL DEFAULT 'Database essay',
      date date NOT NULL DEFAULT '2026-10-01', summary text NOT NULL DEFAULT 'Database summary',
      audio text, duration integer, reading_minutes integer NOT NULL DEFAULT 1,
      body_html text NOT NULL DEFAULT '<p>Database body</p>', draft boolean NOT NULL DEFAULT false
    );
  `);
}, 20_000);

beforeEach(async () => {
  updateTag("content");
  await fixture.client.exec(`
    TRUNCATE posts, secrets;
    INSERT INTO posts (slug, locale, tags) VALUES ('published', 'zh', ARRAY['前端']);
    INSERT INTO posts (slug, locale, draft) VALUES ('private-draft', 'zh', true);
    INSERT INTO secrets (slug, locale) VALUES ('published-life', 'zh');
    INSERT INTO secrets (slug, locale, draft) VALUES ('private-life', 'zh', true);
  `);
});
afterAll(async () => {
  await fixture.client.close();
});

describe("imported content in the existing sections", () => {
  it("merges all 20 pieces once, preserves missing dates and keeps drafts private", async () => {
    const posts = await getPosts("en");
    const secrets = await getSecrets("en");
    expect(posts).toHaveLength(12);
    expect(secrets).toHaveLength(10);
    expect(posts[0]!.slug).toBe("published");
    expect(posts[1]).toMatchObject({ slug: "frontend-deployment", date: "2026-06-28" });
    expect(posts.find((post) => post.slug === "ethers-notes")).toMatchObject({
      date: null,
      locale: "zh",
      isFallback: true,
    });
    expect(posts.find((post) => post.slug === "adaptive-bitrate")).toMatchObject({
      date: null,
      locale: "en",
      isFallback: false,
    });
    expect(secrets.find((post) => post.slug === "kitchen-notes")).toMatchObject({
      date: null,
      format: "fragment",
      kind: "essay",
    });
    expect([...posts, ...secrets].some((post) => post.slug.startsWith("private-"))).toBe(false);
    const editions = await getSitemapEditions();
    expect(editions.posts).toHaveLength(posts.length);
    expect(editions.secrets).toHaveLength(secrets.length);
  });

  it("loads bodies, attributions and language editions only in their classified section", async () => {
    for (const note of getNotes()) {
      const blog = noteDestination(note) === "/blog";
      const read = blog ? getPost : getSecret;
      const other = blog ? getSecret : getPost;
      const editions = blog ? getPostEditions : getSecretEditions;
      const page = await read(note.slug, "en");
      expect(page).toMatchObject({
        title: note.title,
        locale: note.locale,
        date: note.date ?? null,
        summary: note.summary.en,
        isFallback: note.locale !== "en",
        note: { context: note.context, source: note.source },
      });
      expect(page!.html.length).toBeGreaterThan(20);
      expect(await other(note.slug, "en")).toBeNull();
      expect(await editions(note.slug)).toEqual([{ locale: note.locale, date: note.date ?? null }]);
    }
  });

  it("includes imported tags and neighbours in the public index order", async () => {
    expect(await getPostsByTag("前端", "en")).toEqual(
      (await getPosts("en")).filter((post) => post.tags.includes("前端")),
    );
    expect(await getAllTags("en")).toContainEqual({ tag: "前端", count: 2 });
    for (const [rows, adjacent] of [
      [await getPosts("en"), getAdjacentPosts],
      [await getSecrets("en"), getAdjacentSecrets],
    ] as const) {
      for (const [index, row] of rows.entries()) {
        const { older, newer } = await adjacent(row.slug, "en");
        expect(older?.slug).toBe(rows[index + 1]?.slug);
        expect(newer?.slug).toBe(rows[index - 1]?.slug);
      }
    }
  });

  it("prefers database content for a colliding slug without duplicate entries or editions", async () => {
    await fixture.client.exec(`INSERT INTO posts (slug, locale) VALUES ('ethers-notes', 'en');`);
    expect((await getPosts("zh")).filter((post) => post.slug === "ethers-notes")).toHaveLength(1);
    expect(await getPost("ethers-notes", "zh")).toMatchObject({
      title: "Database article",
      locale: "en",
    });
    expect(await getPostEditions("ethers-notes")).toEqual([{ locale: "en", date: "2026-10-01" }]);
    expect(
      (await getSitemapEditions()).posts.filter((post) => post.slug === "ethers-notes"),
    ).toEqual([{ slug: "ethers-notes", locale: "en", date: "2026-10-01" }]);
  });

  it("withdraws colliding imports everywhere when their database replacements become drafts", async () => {
    await fixture.client.exec(`
      INSERT INTO posts (slug, locale, title) VALUES ('ethers-notes', 'zh', 'Database replacement');
      INSERT INTO secrets (slug, locale, title) VALUES ('solitude', 'zh', 'Database replacement');
    `);
    expect((await getPost("ethers-notes", "zh"))?.title).toBe("Database replacement");
    expect((await getSecret("solitude", "zh"))?.title).toBe("Database replacement");
    await fixture.client.exec(`
      UPDATE posts SET draft = true WHERE slug = 'ethers-notes';
      UPDATE secrets SET draft = true WHERE slug = 'solitude';
    `);
    updateTag("content");
    for (const locale of ["zh", "en"] as const) {
      expect(await getPost("ethers-notes", locale)).toBeNull();
      expect(await getSecret("solitude", locale)).toBeNull();
      expect((await getPosts(locale)).some((row) => row.slug === "ethers-notes")).toBe(false);
      expect((await getSecrets(locale)).some((row) => row.slug === "solitude")).toBe(false);
      expect(
        (await getPostsByTag("Ethereum", locale)).some((row) => row.slug === "ethers-notes"),
      ).toBe(false);
      expect(await getAdjacentPosts("ethers-notes", locale)).toEqual({ older: null, newer: null });
      expect(await getAdjacentSecrets("solitude", locale)).toEqual({ older: null, newer: null });
      for (const [slug, read] of [
        ["ethers-notes", getPost],
        ["solitude", getSecret],
      ] as const) {
        const preview = await withContentCacheBypass(true, () => read(slug, locale, true));
        expect(preview?.title).toBe("Database replacement");
        expect(preview).not.toHaveProperty("draft");
        expect(await read(slug, locale)).toBeNull();
      }
    }
    expect(await getPostEditions("ethers-notes")).toEqual([]);
    expect(await getSecretEditions("solitude")).toEqual([]);
    const sitemap = await getSitemapEditions();
    expect(sitemap.posts.some((row) => row.slug === "ethers-notes")).toBe(false);
    expect(sitemap.secrets.some((row) => row.slug === "solitude")).toBe(false);
  });

  it("prefers a published database translation over a draft in the requested language", async () => {
    await fixture.client.exec(`
      INSERT INTO posts (slug, locale, draft) VALUES ('ethers-notes', 'zh', true), ('ethers-notes', 'en', false);
      INSERT INTO secrets (slug, locale, draft) VALUES ('solitude', 'zh', true), ('solitude', 'en', false);
    `);
    for (const locale of ["zh", "en"] as const) {
      for (const [slug, read, list, editions] of [
        ["ethers-notes", getPost, getPosts, getPostEditions],
        ["solitude", getSecret, getSecrets, getSecretEditions],
      ] as const) {
        const article = await read(slug, locale);
        expect(article).toMatchObject({ locale: "en", isFallback: locale !== "en" });
        expect(article).not.toHaveProperty("note");
        expect(article).not.toHaveProperty("draft");
        expect((await list(locale)).filter((row) => row.slug === slug)).toMatchObject([
          { locale: "en" },
        ]);
        expect(await editions(slug)).toEqual([{ locale: "en", date: "2026-10-01" }]);
        expect(await withContentCacheBypass(true, () => read(slug, "zh", true))).toMatchObject({
          locale: "zh",
        });
      }
    }
  });

  it("sees another deployment withdrawing a colliding import after the cache expires", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await fixture.client.exec(`
        INSERT INTO posts (slug, locale) VALUES ('ethers-notes', 'zh');
        INSERT INTO secrets (slug, locale) VALUES ('solitude', 'zh');
      `);
      await getPosts("en");
      await getSecrets("en");
      await getPost("ethers-notes", "en");
      await getSecret("solitude", "en");
      await getPostEditions("ethers-notes");
      await getSecretEditions("solitude");
      await getSitemapEditions();
      await fixture.client.exec(`
        UPDATE posts SET draft = true WHERE slug = 'ethers-notes';
        UPDATE secrets SET draft = true WHERE slug = 'solitude';
      `);
      vi.advanceTimersByTime(31_000);
      expect(await getPost("ethers-notes", "en")).toBeNull();
      expect(await getSecret("solitude", "en")).toBeNull();
      expect((await getPosts("en")).some((row) => row.slug === "ethers-notes")).toBe(false);
      expect((await getSecrets("en")).some((row) => row.slug === "solitude")).toBe(false);
      expect(await getPostEditions("ethers-notes")).toEqual([]);
      expect(await getSecretEditions("solitude")).toEqual([]);
      const sitemap = await getSitemapEditions();
      expect(sitemap.posts.some((row) => row.slug === "ethers-notes")).toBe(false);
      expect(sitemap.secrets.some((row) => row.slug === "solitude")).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it("does not extend the shared 30-second cache through tags or neighbouring pieces", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      await getPosts("zh");
      await getSecrets("zh");
      vi.advanceTimersByTime(20_000);
      await getAllTags("zh");
      await getPostsByTag("前端", "zh");
      await getAdjacentPosts("frontend-deployment", "zh");
      await getAdjacentSecrets("solitude", "zh");
      // Simulate the other deployment editing the shared database, with no local invalidation.
      await fixture.client.exec(`
        UPDATE posts SET tags = ARRAY['已更新'], title = 'Updated article' WHERE slug = 'published';
        UPDATE secrets SET title = 'Updated essay' WHERE slug = 'published-life';
      `);
      vi.advanceTimersByTime(11_000);
      expect(await getAllTags("zh")).toContainEqual({ tag: "已更新", count: 1 });
      expect((await getPostsByTag("前端", "zh")).some((post) => post.slug === "published")).toBe(
        false,
      );
      expect((await getAdjacentPosts("frontend-deployment", "zh")).newer?.title).toBe(
        "Updated article",
      );
      expect((await getAdjacentSecrets("solitude", "zh")).newer?.title).toBe("Updated essay");
    } finally {
      vi.useRealTimers();
    }
  });
});
