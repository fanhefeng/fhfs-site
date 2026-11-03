/** Public read-only flows. Search responses are stubbed; images use local static assets. */
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:4173");
assert.ok(
  ["127.0.0.1", "localhost"].includes(base.hostname) ||
    base.origin === "https://fhfs-site.vercel.app",
  "Use a local preview or the production fhfs-site origin",
);
const browser = await chromium.launch({ channel: "chrome" });
const errors = [];
const measurements = [];
let phase = "startup";
async function open(options = {}) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 }, ...options });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => sessionStorage.setItem("fhfs-overture-seen", "1"));
  return page;
}
async function go(page, path) {
  const response = await page.goto(new URL(path, base).href, { waitUntil: "networkidle" });
  assert.equal(response.status(), 200, path);
  await page.evaluate(() => document.fonts.ready);
}
async function opacity(tip, expected) {
  await expect
    .poll(() => tip.evaluate((el) => Number(getComputedStyle(el).opacity)))
    .toBe(expected);
}
try {
  const page = await open();
  let revision = 1;
  let calls = 0;
  await page.route("**/zh/search.json", (route) => {
    calls++;
    return route.fulfill(
      revision === 3
        ? { status: 503, body: "unavailable" }
        : {
            contentType: "application/json",
            body: JSON.stringify([
              { kind: "page", title: `缓存版本 ${revision}`, text: "", href: "/about" },
            ]),
          },
    );
  });
  await go(page, "/zh/about");
  const dialog = page.getByRole("dialog");
  for (revision of [1, 2, 3, 4]) {
    phase = `search revision ${revision}`;
    await page.getByRole("button", { name: "搜索全站", exact: true }).click();
    await expect(dialog).toBeVisible();
    if (revision === 3) {
      await expect(
        dialog.getByText("索引没能载入，关掉再打开试试。", { exact: true }),
      ).toBeVisible();
      await expect(dialog.locator('a[role="option"]')).toHaveCount(0);
    } else await expect(dialog.getByText(`缓存版本 ${revision}`, { exact: true })).toBeVisible();
    await expect.poll(() => calls).toBe(revision);
    if (revision === 4) {
      const before = page.url();
      await dialog
        .getByRole("combobox")
        .evaluate((input) =>
          input.dispatchEvent(
            new KeyboardEvent("keydown", { key: "Enter", isComposing: true, bubbles: true }),
          ),
        );
      assert.equal(page.url(), before);
      await expect(dialog).toBeVisible();
    }
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
  }

  phase = "date tooltip";
  await go(page, "/zh/lab/changelog");
  const node = page.locator("[data-node]").first();
  await node.scrollIntoViewIfNeeded();
  const tip = node.locator("[data-tip]");
  await node.hover();
  await opacity(tip, 1);
  await page.keyboard.press("Escape");
  await opacity(tip, 0);
  await page.mouse.move(0, 0);
  await node.hover();
  await opacity(tip, 1);
  const box = await tip.boundingBox();
  assert.ok(box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
  await opacity(tip, 1);
  await page.mouse.move(0, 0);
  await opacity(tip, 0);
  await node.focus();
  await opacity(tip, 1);
  await page.keyboard.press("Escape");
  await opacity(tip, 0);
  await expect(node).toBeFocused();

  for (const [width, dpr, locale] of [
    [390, 2, "zh"],
    [1200, 2, "en"],
  ]) {
    phase = `responsive images ${locale} ${width}`;
    const gallery = await open({ viewport: { width, height: 900 }, deviceScaleFactor: dpr });
    await go(gallery, `/${locale}/idols/kobe`);
    const img = gallery.locator("main img").first();
    await img.scrollIntoViewIfNeeded();
    await expect.poll(() => img.evaluate((i) => i.complete && i.naturalWidth > 0)).toBe(true);
    const image = await img.evaluate((i) => ({
      original: new URL(i.src).searchParams.get("url")
        ? new URL(new URL(i.src).searchParams.get("url"), location.origin).href
        : i.src,
      selected: i.currentSrc,
      srcset: i.srcset,
      cssWidth: i.getBoundingClientRect().width,
      width: i.width,
      height: i.height,
    }));
    assert.ok(/\d+w/.test(image.srcset));
    assert.notEqual(image.selected, image.original);
    const selectedResponse = await gallery.request.get(image.selected);
    const originalResponse = await gallery.request.get(image.original);
    assert.ok(selectedResponse.ok() && originalResponse.ok());
    const selectedBytes = (await selectedResponse.body()).length;
    const originalBytes = (await originalResponse.body()).length;
    assert.ok(selectedBytes < originalBytes);
    assert.equal(
      await gallery.evaluate(() => document.documentElement.scrollWidth > innerWidth),
      false,
    );
    measurements.push({ locale, viewport: width, dpr, ...image, selectedBytes, originalBytes });
    await gallery.close();
  }

  phase = "original film preview";
  await go(page, "/zh/films/odyssey");
  const opener = page.locator("main a[data-no-transition]").first();
  const originalHref = await opener.getAttribute("href");
  await expect(opener.locator("img")).toHaveAttribute("srcset", /\d+w/);
  await opener.click();
  const viewer = page.getByRole("dialog");
  await expect(viewer).toBeVisible();
  await expect(viewer.locator("img")).toHaveAttribute("src", originalHref);
  await expect(viewer.locator("img")).not.toHaveAttribute("srcset");
  await page.keyboard.press("Escape");
  await expect(viewer).toBeHidden();
  await expect(opener).toBeFocused();
  assert.deepEqual(errors, []);
  console.log(
    JSON.stringify(
      {
        verified:
          "search refresh/retry/IME, hover and keyboard date bubbles, bilingual responsive images, original film preview and focus",
        measurements,
      },
      null,
      2,
    ),
  );
} catch (error) {
  console.error(JSON.stringify({ phase, errors }));
  throw error;
} finally {
  await browser.close();
}
