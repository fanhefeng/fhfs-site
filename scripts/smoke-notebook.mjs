/** Public, read-only browser smoke. Does not use the admin/database E2E harness. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:4181");
assert.ok(
  ["127.0.0.1", "localhost"].includes(base.hostname) ||
    base.origin === "https://fhfs-site.vercel.app",
  "Use a local preview or the production fhfs origin",
);
const notes = JSON.parse(
  await readFile(new URL("../src/content/notebook/index.json", import.meta.url)),
);
const destination = (note) => (note.section === "it" ? "/blog" : "/secrets");
const pathOf = (note) => `${destination(note)}/${note.slug}`;
const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
async function open(options = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 960 }, ...options });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => sessionStorage.setItem("fhfs-overture-seen", "1"));
  return page;
}
async function go(page, path) {
  const response = await page.goto(new URL(path, base).href, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200, path);
  await page.evaluate(() => document.fonts.ready);
}
async function fits(page) {
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}
try {
  const page = await open();
  for (const locale of ["zh", "en"]) {
    for (const section of ["/blog", "/secrets"]) {
      await go(page, `/${locale}${section}`);
      await expect(page.locator('main a[href*="/blog/notes"]')).toHaveCount(0);
      for (const note of notes) {
        const link = page.locator(`main a[href="/${locale}${pathOf(note)}"]`);
        await expect(link).toHaveCount(destination(note) === section ? 1 : 0);
      }
      await expect(
        page.getByRole("heading", {
          name: locale === "zh" ? "日期未记" : "Date unrecorded",
          exact: true,
        }),
      ).toBeVisible();
      await fits(page);
    }
    const search = await page.request.get(new URL(`/${locale}/search.json`, base).href);
    assert.equal(search.status(), 200);
    const entries = await search.json();
    assert.ok(entries.every((entry) => !entry.href.includes("/blog/notes")));
    for (const note of notes) {
      const matches = entries.filter((entry) => entry.href === pathOf(note));
      assert.equal(matches.length, 1, `${locale}/${note.slug} appears once in search`);
      assert.equal(matches[0].kind, note.section === "it" ? "post" : "secret");
    }
    for (const note of notes) {
      const path = `/${locale}${pathOf(note)}`;
      const response = await page.request.get(new URL(path, base).href);
      assert.equal(response.status(), 200, path);
      const html = await response.text();
      assert.ok(html.includes(note.title));
      assert.ok(!html.includes("The page could not be loaded"));
      assert.ok(!html.includes("Invalid Date"));
      const legacy = await page.request.get(
        new URL(`/${locale}/blog/notes/${note.slug}`, base).href,
        { maxRedirects: 0 },
      );
      assert.equal(legacy.status(), 301);
      assert.equal(new URL(legacy.headers().location, base).pathname, path);
    }
    const rss = await page.request.get(new URL(`/${locale}/rss.xml`, base).href);
    const feed = await rss.text();
    assert.ok(
      feed.includes(
        `/${notes.find((note) => note.slug === "frontend-deployment").locale}/blog/frontend-deployment`,
      ),
    );
    assert.ok(!feed.includes("Invalid Date"));
    assert.ok(!feed.includes("/blog/notes"));
    for (const note of notes.filter((note) => !note.date)) assert.ok(!feed.includes(pathOf(note)));
  }

  await go(page, "/zh/life");
  for (const note of notes.filter((note) => destination(note) === "/secrets"))
    await expect(page.locator(`main a[href="/zh${pathOf(note)}"]`)).toHaveCount(1);
  await page.locator('main a[href="/zh/secrets/solitude"]').click();
  await expect(page).toHaveURL(/\/zh\/secrets\/solitude$/);
  await page.getByRole("link", { name: "返回生活", exact: true }).click();
  await expect(page).toHaveURL(/\/zh\/life$/);
  await go(page, "/zh/blog");
  await page.screenshot({ path: "/private/tmp/fhfs-writing-classified.png" });
  await page.locator('main a[href="/zh/blog/frontend-deployment"]').click();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("前端部署与运维原理详解");
  await page.locator("summary").click();
  const toc = page.getByRole("navigation", { name: "本篇章节" });
  const last = toc.getByRole("link").last();
  const target = await last.getAttribute("href");
  await last.click();
  await expect
    .poll(() =>
      page.evaluate(
        (hash) => document.getElementById(hash.slice(1))?.getBoundingClientRect().top,
        target,
      ),
    )
    .toBeGreaterThan(70);
  await expect
    .poll(() =>
      page.evaluate(
        (hash) => document.getElementById(hash.slice(1))?.getBoundingClientRect().top,
        target,
      ),
    )
    .toBeLessThan(300);
  await fits(page);

  await go(page, `/zh/blog/tags/${encodeURIComponent("前端")}`);
  await expect(page.locator('main a[href="/zh/blog/frontend-deployment"]')).toBeVisible();
  for (const [path, expected] of [
    ["/zh/blog/notes", "/zh/blog"],
    ["/en/blog/notes?section=it", "/en/blog"],
    ["/zh/blog/notes?section=life", "/zh/life"],
    ["/en/blog/notes?section=writing", "/en/life"],
  ]) {
    const response = await page.request.get(new URL(path, base).href, { maxRedirects: 0 });
    assert.equal(response.status(), 301, path);
    assert.equal(new URL(response.headers().location, base).pathname, expected);
  }
  for (const path of [
    "/zh/blog/notes/not-a-note",
    "/fr/blog/notes",
    "/zh/blog/solitude",
    "/zh/secrets/ethers-notes",
  ])
    assert.equal((await page.request.get(new URL(path, base).href)).status(), 404, path);
  const xml = await (await page.request.get(new URL("/sitemap.xml", base).href)).text();
  for (const note of notes) assert.ok(xml.includes(`/${note.locale}${pathOf(note)}`));
  assert.ok(!xml.includes("/blog/notes"));

  const mobile = await open({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    colorScheme: "dark",
  });
  for (const section of ["/blog", "/secrets", "/life"]) {
    await go(mobile, `/en${section}`);
    await fits(mobile);
  }
  await mobile.screenshot({ path: "/private/tmp/fhfs-life-classified-mobile.png" });
  for (const slug of [
    "ethers-notes",
    "css-reference-shelf",
    "solitude",
    "adaptive-bitrate",
    "a-fathers-back",
    "kitchen-notes",
  ]) {
    const note = notes.find((note) => note.slug === slug);
    await go(mobile, `/en${pathOf(note)}`);
    await expect(mobile.getByRole("heading", { level: 1 })).toHaveText(note.title);
    const canonical = await mobile.locator('link[rel="canonical"]').getAttribute("href");
    assert.ok(canonical.endsWith(`/${note.locale}${pathOf(note)}`));
    await expect(mobile.locator("article")).toHaveAttribute(
      "lang",
      note.locale === "zh" ? "zh-CN" : "en",
    );
    if (note.source) await expect(mobile.locator("aside")).toContainText(note.source.author);
    await fits(mobile);
  }
  await go(mobile, "/zh/secrets/solitude");
  await mobile.screenshot({ path: "/private/tmp/fhfs-life-reading.png" });
  await mobile.close();
  await page.close();
  assert.deepEqual(errors, [], "Browser has no uncaught errors");
  console.log(
    "Verified 20 classified pieces in both languages, lists, life entry, 40 legacy redirects, tags, search, TOC, canonicals, RSS, 404s, sitemap, mobile, dark theme and reduced motion.",
  );
} finally {
  await browser.close();
}
