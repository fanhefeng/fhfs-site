/** Public, read-only browser smoke. Does not use the admin/database E2E harness. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { chromium, expect } from "@playwright/test";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:4181");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname), "Use a local preview");
const notes = JSON.parse(
  await readFile(new URL("../src/content/notebook/index.json", import.meta.url)),
);
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
  await go(page, "/zh/blog");
  await page.getByRole("link", { name: /手记 · 写作/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "手记", exact: true })).toBeVisible();
  await expect(page.getByRole("status")).toHaveText("20 篇手记");
  await page.getByRole("button", { name: "IT 笔记", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText("11 篇手记");
  await expect(page).toHaveURL(/section=it/);
  await page.reload({ waitUntil: "networkidle" });
  await expect(page.getByRole("button", { name: "IT 笔记", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await page.getByRole("searchbox").fill("ETHERS.JS Ethereum");
  await expect(page.getByRole("status")).toHaveText("1 篇手记");
  await page.getByRole("searchbox").fill("没有这个词条");
  await expect(page.getByRole("status")).toHaveText("0 篇手记");
  await expect(page.getByText("暂时没有匹配的手记，试试其他关键词。")).toBeVisible();
  await page.getByRole("searchbox").fill("");
  const filter = page.getByRole("group", { name: "按内容分类" });
  await filter.getByRole("button", { name: "IT 笔记", exact: true }).focus();
  await page.keyboard.press("Home");
  await expect(filter.getByRole("button", { name: "全部", exact: true })).toBeFocused();
  await expect(page.getByRole("status")).toHaveText("20 篇手记");
  await fits(page);
  await page.screenshot({ path: "/private/tmp/fhfs-notebook-desktop.png" });

  await go(page, "/zh/blog/notes/frontend-deployment");
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

  for (const locale of ["zh", "en"]) {
    const search = await page.request.get(new URL(`/${locale}/search.json`, base).href);
    assert.equal(search.status(), 200);
    const entries = await search.json();
    for (const note of notes)
      assert.ok(entries.some((entry) => entry.href === `/blog/notes/${note.slug}`));
    for (const note of notes) {
      const response = await page.request.get(
        new URL(`/${locale}/blog/notes/${note.slug}`, base).href,
      );
      assert.equal(response.status(), 200, `${locale}/${note.slug}`);
      const html = await response.text();
      assert.ok(html.includes(`<article lang="${note.locale === "zh" ? "zh-CN" : "en"}"`));
      assert.match(html, /<h1\b/);
      assert.ok(!html.includes("The page could not be loaded"));
    }
  }
  for (const path of ["/zh/blog/notes/not-a-note", "/fr/blog/notes"])
    assert.equal((await page.request.get(new URL(path, base).href)).status(), 404);
  const xml = await (await page.request.get(new URL("/sitemap.xml", base).href)).text();
  for (const note of notes) assert.ok(xml.includes(`/${note.locale}/blog/notes/${note.slug}`));

  const mobile = await open({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
    colorScheme: "dark",
  });
  await go(mobile, "/en/blog/notes");
  await expect(
    mobile.getByRole("heading", { level: 1, name: "Notebook", exact: true }),
  ).toBeVisible();
  await expect(mobile.getByRole("status")).toHaveText("20 entries");
  await fits(mobile);
  await mobile.screenshot({ path: "/private/tmp/fhfs-notebook-mobile.png" });
  for (const slug of ["ethers-notes", "css-reference-shelf", "solitude", "adaptive-bitrate"]) {
    await go(mobile, `/en/blog/notes/${slug}`);
    if (slug !== "adaptive-bitrate")
      await expect(
        mobile.getByText("This note is available in Chinese. The original text follows."),
      ).toBeVisible();
    const canonical = await mobile.locator('link[rel="canonical"]').getAttribute("href");
    assert.ok(
      canonical.includes(`/${slug === "adaptive-bitrate" ? "en" : "zh"}/blog/notes/${slug}`),
    );
    await fits(mobile);
  }
  await go(mobile, "/zh/blog/notes/solitude");
  await mobile.screenshot({ path: "/private/tmp/fhfs-notebook-reading.png" });
  await mobile.close();
  await page.close();
  assert.deepEqual(errors, [], "Browser has no uncaught errors");
  console.log(
    "Verified 40 bilingual note pages, blog entry, filters, keyboard, search, TOC, canonicals, 404s, sitemap, mobile, dark theme and reduced motion.",
  );
} finally {
  await browser.close();
}
