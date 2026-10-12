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
