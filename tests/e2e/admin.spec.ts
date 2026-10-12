import { readFile } from "node:fs/promises";
import { SignJWT } from "jose";
import { expect, test, type Page } from "@playwright/test";
import zh from "../../messages/zh.json";
import en from "../../messages/en.json";

type TestSession = { secret: string; password: string };
let session: TestSession;
test.beforeAll(async () => {
  try {
    session = JSON.parse(await readFile(".e2e/session.json", "utf8")) as TestSession;
  } catch {
    throw new Error("Admin tests must run through pnpm e2e against the marked test database");
  }
});

async function authenticate(page: Page, expired = false) {
  const token = await new SignJWT({ sub: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + (expired ? -60 : 3600))
    .sign(new TextEncoder().encode(session.secret));
  await page.context().addCookies([
    {
      name: "fhfs_admin",
      value: token,
      url: "http://localhost:3100",
      httpOnly: true,
      sameSite: "Lax",
    },
  ]);
}

test("an administrator can log in with the generated test password", async ({ page }) => {
  await page.goto("/admin/login");
  await page.getByLabel("密码", { exact: true }).fill(session.password);
  await page.getByRole("button", { name: "进入", exact: true }).click();
  await expect(page).toHaveURL(/\/admin$/);
});

test("saving a new post updates its page, search, RSS and sitemap", async ({ page, browser }) => {
  const visitor = await browser.newContext({ baseURL: "http://localhost:3100" });
  try {
    await visitor.request.get("http://localhost:3100/zh/search.json");
    await visitor.request.get("http://localhost:3100/zh/rss.xml");
    await visitor.request.get("http://localhost:3100/sitemap.xml");
    await authenticate(page);
    await page.goto("/admin/posts/new");
    const slug = `e2e-created-${Date.now()}`;
    const title = `保存流程验证 ${slug}`;
    await page.getByLabel("slug", { exact: true }).fill(slug);
    await page.getByLabel("标题", { exact: true }).fill(title);
    await page.getByLabel("正文（Markdown）", { exact: true }).fill("浏览器保存后的正文。");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/admin/posts/${slug}/zh$`));
    const article = await visitor.newPage();
    await article.goto(`/zh/blog/${slug}`);
    await expect(article.locator("main h1")).toHaveText(title);
    await expect(article.getByText("浏览器保存后的正文。", { exact: true })).toBeVisible();
    for (const [url, value] of [
      ["/zh/search.json", title],
      ["/zh/rss.xml", slug],
      ["/sitemap.xml", slug],
    ]) {
      await expect
        .poll(async () => (await visitor.request.get(`http://localhost:3100${url}`)).text())
        .toContain(value!);
    }
  } finally {
    await visitor.close();
  }
});

test("a server validation error preserves the unsaved article", async ({ page }) => {
  await authenticate(page);
  await page.goto("/admin/posts/e2e-fixture/zh");
  await page.getByLabel("标题", { exact: true }).fill("还没保存的标题");
  await page.getByLabel("正文（Markdown）", { exact: true }).fill("还没保存的正文");
  await page.getByLabel("日期", { exact: true }).fill("2026-02-30");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("真实存在");
  await expect(page.getByLabel("标题", { exact: true })).toHaveValue("还没保存的标题");
  await expect(page.getByLabel("正文（Markdown）", { exact: true })).toHaveValue("还没保存的正文");
});

test("an expired session rejects saving without losing typed text", async ({ page }) => {
  await authenticate(page);
  await page.goto("/admin/posts/e2e-fixture/zh");
  await page.getByLabel("标题", { exact: true }).fill("过期时仍保留的标题");
  await page.getByLabel("正文（Markdown）", { exact: true }).fill("过期时仍保留的正文");
  await authenticate(page, true);
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("登录已过期");
  await expect(page.getByLabel("标题", { exact: true })).toHaveValue("过期时仍保留的标题");
  await expect(page.getByLabel("正文（Markdown）", { exact: true })).toHaveValue(
    "过期时仍保留的正文",
  );
});

test("a failed save request preserves text and can be retried", async ({ page }) => {
  await authenticate(page);
  await page.goto("/admin/posts/e2e-fixture/zh");
  await page.getByLabel("标题", { exact: true }).fill("断网后重试的标题");
  await page.getByLabel("正文（Markdown）", { exact: true }).fill("断网后重试的正文");
  await page.route("**/admin/posts/e2e-fixture/zh", async (route) => {
    if (route.request().method() === "POST") await route.abort("failed");
    else await route.continue();
  });
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("没保存上");
  await expect(page.getByLabel("标题", { exact: true })).toHaveValue("断网后重试的标题");
  await expect(page.getByLabel("正文（Markdown）", { exact: true })).toHaveValue(
    "断网后重试的正文",
  );
  await page.unroute("**/admin/posts/e2e-fixture/zh");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("已保存");
});

test("draft preview requires a live session and exits back to public visibility", async ({
  page,
  browser,
}) => {
  const visitor = await browser.newContext();
  try {
    expect((await visitor.request.get("http://localhost:3100/zh/blog/e2e-draft")).status()).toBe(
      404,
    );
    await authenticate(page);
    await page.goto("/admin/preview?kind=post&slug=e2e-draft&locale=zh");
    await expect(page.locator("main h1")).toHaveText("私有测试草稿");
    await expect(page.getByRole("button", { name: "退出预览" })).toBeVisible();
    await authenticate(page, true);
    expect((await page.reload())?.status()).toBe(404);
    await authenticate(page);
    await page.goto("/admin/preview?kind=post&slug=e2e-draft&locale=zh");
    await page.getByRole("button", { name: "退出预览" }).click();
    await expect(page.getByRole("button", { name: "退出预览" })).toHaveCount(0);
    expect((await page.goto("/zh/blog/e2e-draft"))?.status()).toBe(404);
  } finally {
    await visitor.close();
  }
});

test("a duplicate slug cannot overwrite an existing article", async ({ page }) => {
  await authenticate(page);
  await page.goto("/zh/blog/e2e-fixture");
  const original = await page.locator("main h1").textContent();
  await page.goto("/admin/posts/new");
  await page.getByLabel("slug", { exact: true }).fill("e2e-fixture");
  await page.getByLabel("标题", { exact: true }).fill("不应覆盖原文的标题");
  await page.getByLabel("正文（Markdown）", { exact: true }).fill("不应覆盖原文的正文");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("slug 已存在");
  await expect(page.getByLabel("标题", { exact: true })).toHaveValue("不应覆盖原文的标题");
  await page.goto("/zh/blog/e2e-fixture");
  await expect(page.locator("main h1")).toHaveText(original!);
});

test("copy overrides update the public page and clearing restores the catalogue", async ({
  page,
  browser,
}) => {
  const visitor = await browser.newContext({ baseURL: "http://localhost:3100" });
  try {
    const publicPage = await visitor.newPage();
    await publicPage.goto("/zh");
    await authenticate(page);
    await page.goto("/admin/copy?ns=home");
    const value = `浏览器文案验证 ${Date.now()}`;
    await page.locator('input[name="home.slogan.zh"]').fill(value);
    await page.getByRole("button", { name: "保存这一组", exact: true }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("已保存");
    await publicPage.reload();
    await expect(publicPage.locator("footer")).toContainText(value);
    await publicPage.goto("/en");
    await expect(publicPage.locator("footer")).toContainText(en.home.slogan);
    await page.locator('input[name="home.slogan.zh"]').fill("");
    await page.getByRole("button", { name: "保存这一组", exact: true }).click();
    await expect(page.locator('input[name="home.slogan.zh"]')).toHaveValue(zh.home.slogan);
    await publicPage.goto("/zh");
    await expect(publicPage.locator("footer")).toContainText(zh.home.slogan);
    await expect(publicPage.locator("footer")).not.toContainText(value);
  } finally {
    await visitor.close();
  }
});

test("invalid ICU copy is refused without clearing the edited value", async ({ page }) => {
  await authenticate(page);
  await page.goto("/admin/copy?ns=home");
  const invalid = "尚未保存的 {e2eUnexpectedArgument}";
  await page.locator('input[name="home.slogan.zh"]').fill(invalid);
  await page.getByRole("button", { name: "保存这一组", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "默认文案里没有 {e2eUnexpectedArgument}",
  );
  await expect(page.locator('input[name="home.slogan.zh"]')).toHaveValue(invalid);
  await page.reload();
  await expect(page.locator('input[name="home.slogan.zh"]')).toHaveValue(zh.home.slogan);
});

test("an unknown local media file is refused while keeping the moment text", async ({ page }) => {
  await authenticate(page);
  await page.goto("/admin/moments");
  await page.getByRole("button", { name: "写一条", exact: true }).click();
  await page.getByLabel("key", { exact: false }).fill(`e2e-created-media-${Date.now()}`);
  await page.getByLabel("正文", { exact: false }).fill("媒体校验失败后仍在的正文");
  await page
    .getByLabel("图片 / 语音 / 视频", { exact: false })
    .fill("image /moments/e2e-missing.jpg 100x100");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("main").getByRole("alert")).toContainText("不在 assets.gen.json");
  await expect(page.getByLabel("正文", { exact: false })).toHaveValue("媒体校验失败后仍在的正文");
});

test("film rows preserve edited text when reordered, saved, previewed and deleted", async ({
  page,
}) => {
  await authenticate(page);
  await page.goto("/admin/films");
  await page.getByRole("button", { name: "新电影", exact: true }).click();
  const key = `e2e-created-film-${Date.now()}`;
  const title = `浏览器行表单验证 ${key}`;
  await page.getByLabel("key（网址 /films/…）", { exact: false }).fill(key);
  await page.locator('input[name="title.zh"]').fill(title);
  const lines = page.getByRole("group", { name: /每一句/ });
  await lines.getByRole("button", { name: "加一句", exact: true }).click();
  await lines.locator('textarea[name="lines.0.text.zh"]').fill("第一句测试台词");
  await lines.getByRole("button", { name: "加一句", exact: true }).click();
  await lines.locator('textarea[name="lines.1.text.zh"]').fill("第二句测试台词");
  await lines.getByRole("button", { name: "下移", exact: true }).first().click();
  await expect(lines.locator('textarea[name="lines.0.text.zh"]')).toHaveValue("第二句测试台词");
  await expect(lines.locator('textarea[name="lines.1.text.zh"]')).toHaveValue("第一句测试台词");
  await page.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("已保存");
  await page.reload();
  await page.getByRole("button", { name: new RegExp(title) }).click();
  await expect(page.locator('textarea[name="lines.0.text.zh"]')).toHaveValue("第二句测试台词");
  await expect(page.locator('textarea[name="lines.1.text.zh"]')).toHaveValue("第一句测试台词");
  await page.goto(`/admin/preview?kind=film&slug=${key}&locale=zh`);
  await expect(page.locator("main h1")).toHaveText(title);
  const content = await page.locator("main").textContent();
  expect(content!.indexOf("第二句测试台词")).toBeGreaterThanOrEqual(0);
  expect(content!.indexOf("第二句测试台词")).toBeLessThan(content!.indexOf("第一句测试台词"));
  await page.goto("/admin/films");
  await page.getByRole("button", { name: new RegExp(title) }).click();
  const remove = page.getByRole("button", { name: new RegExp(`删除这条.*${key}`) });
  await remove.click();
  await expect(page.getByRole("button", { name: "算了", exact: true })).toBeFocused();
  await page.getByRole("button", { name: "算了", exact: true }).click();
  await expect(remove).toBeFocused();
  await remove.click();
  await page.getByRole("button", { name: "确认删除", exact: true }).click();
  await expect(page.getByRole("button", { name: new RegExp(title) })).toHaveCount(0);
  expect((await page.goto(`/admin/preview?kind=film&slug=${key}&locale=zh`))?.status()).toBe(404);
});
