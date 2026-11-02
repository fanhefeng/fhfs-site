/** Public, read-only browser checks. Never run the admin/database E2E harness. */
import assert from "node:assert/strict";
import { chromium, expect } from "@playwright/test";

const base = new URL(process.argv[2] ?? "http://127.0.0.1:4173");
assert.ok(["127.0.0.1", "localhost"].includes(base.hostname), "Use a local preview server");
const route = (locale) => new URL(`/${locale}/lab/magazine`, base).href;
const errors = [];
async function open(browser, options = {}) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 1100 }, ...options });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.addInitScript(() => sessionStorage.setItem("fhfs-overture-seen", "1"));
  await page.addInitScript(() => {
    window.magazineDraws = 0;
    // oxlint-disable-next-line typescript/unbound-method -- Invoked with the original WebGL context below.
    const original = WebGL2RenderingContext.prototype.drawArrays;
    WebGL2RenderingContext.prototype.drawArrays = function (...args) {
      if (this.canvas.classList.contains("mag-canvas")) window.magazineDraws++;
      return original.apply(this, args);
    };
  });
  return page;
}
async function loaded(page, locale = "zh") {
  assert.equal((await page.goto(route(locale), { waitUntil: "networkidle" })).status(), 200);
  await page.evaluate(() => document.fonts.ready);
  await page.locator(".mag-stage").scrollIntoViewIfNeeded();
}
async function html(page) {
  await expect(page.locator(".mag-stage")).toHaveAttribute("data-view", "html");
  await expect(page.locator(".mag-html .mag-read")).toBeVisible();
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
}
// Compute the point on the printed surface, rather than clicking a hidden
// unprojected DOM box. This catches trial/shipped geometry API mismatches.
async function point(page, selector, x = 0.5, y = 0.5) {
  return page.evaluate(
    ({ selector, x, y }) => {
      const canvas = document.querySelector(".mag-canvas");
      const cover = canvas.querySelector(".mag-cover");
      const element = canvas.querySelector(selector);
      const matrix = cover.style.transform
        ? new DOMMatrix(cover.style.transform)
        : canvas.getElementTransform(cover);
      const local = new DOMPoint(
        element.offsetLeft + element.offsetWidth * x,
        element.offsetTop + element.offsetHeight * y,
      ).matrixTransform(matrix);
      const box = canvas.getBoundingClientRect();
      return { x: box.left + local.x / local.w, y: box.top + local.y / local.w };
    },
    { selector, x, y },
  );
}

const plain = await chromium.launch({
  channel: "chrome",
  args: ["--disable-blink-features=CanvasDrawElement"],
});
try {
  for (const locale of ["zh", "en"]) {
    const page = await open(plain, { viewport: { width: 390, height: 844 } });
    const rendererRequests = [];
    page.on("request", (request) => {
      if (request.url().includes("magazineRenderer")) rendererRequests.push(request.url());
    });
    await loaded(page, locale);
    await html(page);
    await page.locator(".mag-html .mag-save").click();
    await expect(page.locator(".mag-html .mag-save")).toHaveAttribute("aria-pressed", "true");
    assert.deepEqual(rendererRequests, [], "Unsupported browsers skip the renderer chunk");
    await page.close();
  }
  const noScript = await open(plain, { javaScriptEnabled: false });
  await loaded(noScript);
  await html(noScript);
  assert.equal(await noScript.locator(".mag-html .mag-read").getAttribute("href"), "/zh/about");
  await noScript.close();
} finally {
  await plain.close();
}

const native = await chromium.launch({
  channel: "chrome",
  args: ["--enable-blink-features=CanvasDrawElement"],
});
try {
  for (const locale of ["zh", "en"]) {
    const page = await open(native);
    await loaded(page, locale);
    await expect(page.locator(".mag-stage")).toHaveAttribute("data-view", "3d");
    const draws = await page.evaluate(() => window.magazineDraws);
    await page.waitForTimeout(300);
    assert.equal(
      await page.evaluate(() => window.magazineDraws),
      draws,
      "A resting cover draws no frames",
    );
    const bookmark = await point(page, ".mag-save");
    await page.mouse.click(bookmark.x, bookmark.y);
    await expect(page.locator(".mag-canvas .mag-save")).toHaveAttribute("aria-pressed", "true");
    // Keyboard interaction uses the same real HTML controls.
    await page.locator(".mag-canvas .mag-save").focus();
    await page.keyboard.press("Space");
    await expect(page.locator(".mag-canvas .mag-save")).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("Space");
    await page.locator(".mag-controls > button").click();
    await html(page);
    await expect(page.locator(".mag-html .mag-save")).toHaveAttribute("aria-pressed", "true");
    await page.locator(".mag-controls > button").click();
    await expect(page.locator(".mag-stage")).toHaveAttribute("data-view", "3d");
    await expect(page.locator(".mag-canvas .mag-save")).toHaveAttribute("aria-pressed", "true");

    const start = await point(page, "h2", 0.02, 0.2);
    const end = await point(page, "h2", 0.9, 0.2);
    await page.mouse.move(start.x, start.y);
    await page.mouse.down();
    await page.mouse.move(end.x, end.y, { steps: 15 });
    await page.mouse.up();
    assert.ok(
      (await page.evaluate(() => getSelection().toString())).includes(
        locale === "zh" ? "把日常" : "A small",
      ),
    );
    await page.evaluate(() => getSelection().removeAllRanges());

    await page.evaluate(() => {
      document.documentElement.dataset.theme = "dark";
    });
    await expect(page.locator(".mag-canvas .mag-cover")).toHaveCSS(
      "background-color",
      "rgb(14, 14, 17)",
    );
    const link = await point(page, ".mag-read");
    await page.mouse.click(link.x, link.y);
    await page.waitForURL(`**/${locale}/about`);
    await page.close();
  }

  const mobile = await open(native, {
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    deviceScaleFactor: 2,
  });
  await loaded(mobile);
  await expect(mobile.locator(".mag-stage")).toHaveAttribute("data-view", "3d");
  await mobile.locator(".mag-turn button").last().click();
  assert.equal(
    await mobile.evaluate(() => document.documentElement.scrollWidth > innerWidth),
    false,
  );
  // Losing the GPU returns to HTML without losing the current bookmark.
  await mobile.locator(".mag-canvas .mag-save").focus();
  await mobile.keyboard.press("Space");
  await mobile.evaluate(() =>
    document
      .querySelector(".mag-canvas")
      .getContext("webgl2")
      .getExtension("WEBGL_lose_context")
      .loseContext(),
  );
  await html(mobile);
  await expect(mobile.locator(".mag-html .mag-save")).toHaveAttribute("aria-pressed", "true");
  await mobile.close();

  for (const reason of ["save-data", "no-gpu", "chunk-failed", "forced-colors"]) {
    const page = await open(native, {
      forcedColors: reason === "forced-colors" ? "active" : "none",
    });
    if (reason === "save-data")
      await page.addInitScript(() =>
        Object.defineProperty(navigator, "connection", { value: { saveData: true } }),
      );
    if (reason === "no-gpu")
      await page.addInitScript(() => {
        // oxlint-disable-next-line typescript/unbound-method -- Invoked with the original canvas below.
        const original = HTMLCanvasElement.prototype.getContext;
        HTMLCanvasElement.prototype.getContext = function (kind, ...options) {
          return kind.startsWith("webgl") ? null : original.call(this, kind, ...options);
        };
      });
    if (reason === "chunk-failed")
      await page.route("**/*.js*", async (route) => {
        const response = await route.fetch();
        const body = await response.text();
        if (body.includes("texElementSubImage2D")) await route.abort();
        else await route.fulfill({ response, body });
      });
    await loaded(page);
    await html(page);
    await expect(page.locator(".mag-canvas")).toHaveCount(0);
    await page.close();
  }
} finally {
  await native.close();
}
assert.deepEqual(errors, []);
console.log(
  "Verified bilingual native 3D, projected pointer/keyboard interaction, text selection, themes, mobile, bookmark continuity, SSR without JavaScript, and HTML fallbacks.",
);
