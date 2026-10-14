import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  // Returning visits skip the session-only entry effects.
  await page.addInitScript(() => {
    sessionStorage.setItem("fhfs-overture-seen", "1");
    sessionStorage.setItem("fhfs-splash-seen", "1");
  });
});

for (const locale of ["zh", "en"]) {
  test(`${locale}: the home page is readable and search can be opened with the keyboard`, async ({
    page,
  }) => {
    await page.goto(`/${locale}`);
    await expect(page.locator("main h1")).toBeVisible();
    await page.keyboard.press("/");
    const search = page.getByRole("dialog");
    await expect(search).toBeVisible();
    await expect(search.getByRole("combobox")).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(search).not.toBeVisible();
  });
}

test("without WebGL the intro remains a readable document", async ({ page }) => {
  await page.addInitScript(() => {
    // Keep the original receiver when forwarding the unaffected 2D overload.
    // eslint-disable-next-line typescript/unbound-method
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (type.startsWith("webgl")) return null;
      return Reflect.apply(original, this, [type, ...args]);
    } as typeof original;
  });
  await page.goto("/zh/intro");
  await expect(page.locator("main h1")).toBeVisible();
  await expect(page.locator("main section")).toHaveCount(7);
});

test("unknown pages return 404", async ({ page }) => {
  const response = await page.goto("/zh/e2e-does-not-exist");
  expect(response?.status()).toBe(404);
  await expect(page.locator("h1")).toBeVisible();
});

test("unauthenticated action requests reach their authorization boundary", async ({ request }) => {
  const url = "/admin/posts/e2e-does-not-exist/zh";
  const visit = await request.get(url, { maxRedirects: 0 });
  expect(visit.status()).toBe(307);
  expect(new URL(visit.headers().location!, visit.url()).pathname).toBe("/admin/login");
  const action = await request.post(url, {
    headers: { "next-action": "invalid-action-reference" },
    maxRedirects: 0,
  });
  // Invalid references fail inside Next; an expired editor must never receive
  // a proxy redirect in place of the real action's SESSION_EXPIRED response.
  expect(action.headers().location).toBeUndefined();
  expect(action.status()).toBeGreaterThanOrEqual(400);
});

test("the intro opening is readable before JavaScript and the 3D runtime load", async ({
  browser,
  baseURL,
}) => {
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("/zh/intro");
    // This is the visible opening, rather than the off-screen accessible copy.
    const name = page.locator("main p.text-display-sm").first();
    await expect(name).toBeVisible();
    await expect(name).toBeInViewport();
    await expect(page.locator("main canvas")).toHaveCount(0);
  } finally {
    await context.close();
  }
});

test("calendar dates expose named links that work with the keyboard", async ({ page }) => {
  await page.goto("/zh/moments");
  const calendar = page.locator("main svg[aria-label]").first();
  await expect(calendar).toHaveAttribute("role", "group");
  const day = calendar.getByRole("link").first();
  await expect(day).toHaveAccessibleName(/\d/);
  await day.focus();
  await expect(day).toBeFocused();
  const target = await day.getAttribute("href");
  await page.keyboard.press("Enter");
  await expect.poll(() => new URL(page.url()).hash).toBe(target);
});

for (const [study, selector] of [
  ["dissolve", ".dz-canvas"],
  ["lens-slider", ".ls-canvas"],
] as const) {
  test(`${study}: the canvas redraws after context restoration and resize`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.addInitScript(() => {
      for (const method of ["drawArrays", "drawElements"] as const) {
        // The original receiver is supplied by Reflect.apply below.
        // eslint-disable-next-line typescript/unbound-method
        const original = WebGL2RenderingContext.prototype[method];
        WebGL2RenderingContext.prototype[method] = function (...args: number[]) {
          const canvas = this.canvas;
          if (canvas instanceof HTMLCanvasElement) {
            canvas.dataset.testDraws = String(Number(canvas.dataset.testDraws ?? 0) + 1);
          }
          Reflect.apply(original, this, args);
        };
      }
    });
    await page.goto(`/zh/lab/${study}`);
    const canvas = page.locator(selector);
    await canvas.scrollIntoViewIfNeeded();
    const draws = async () => Number((await canvas.getAttribute("data-test-draws")) ?? 0);
    await expect.poll(draws).toBeGreaterThan(0);
    const before = await draws();
    await canvas.evaluate(async (element) => {
      const context = (element as HTMLCanvasElement).getContext("webgl2");
      const extension = context?.getExtension("WEBGL_lose_context");
      if (!extension) throw new Error("The browser must support a real WebGL context restore");
      const lost = new Promise<void>((resolve) =>
        element.addEventListener("webglcontextlost", () => resolve(), { once: true }),
      );
      const restored = new Promise<void>((resolve) =>
        element.addEventListener("webglcontextrestored", () => resolve(), { once: true }),
      );
      extension.loseContext();
      await lost;
      // Chrome permits restoration after the loss event has finished dispatching,
      // rather than in the microtask that resumes this listener's promise.
      await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
      extension.restoreContext();
      await restored;
    });
    await expect.poll(draws).toBeGreaterThan(before);
    const width = await canvas.evaluate((element) => (element as HTMLCanvasElement).width);
    const viewport = page.viewportSize()!;
    await page.setViewportSize({ width: viewport.width + 80, height: viewport.height });
    await expect
      .poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).width))
      .not.toBe(width);
    expect(errors).toEqual([]);
  });
}
