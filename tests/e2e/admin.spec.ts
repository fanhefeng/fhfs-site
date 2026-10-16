import { readFile } from "node:fs/promises";
import { SignJWT } from "jose";
import { expect, test, type Page } from "@playwright/test";
import zh from "../../messages/zh.json";
import en from "../../messages/en.json";
import { asset } from "../../src/lib/asset";
import { MEDIA_ORIGIN } from "../../src/config/csp";

type TestSession = { secret: string; password: string; mediaSecret: string };
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

async function localMedia(page: Page) {
  await page.route(`${MEDIA_ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (!url.pathname.includes("/moments/uploads/")) {
      await route.continue();
      return;
    }
    const response = await route.fetch({ url: `http://127.0.0.1:8787${url.pathname}` });
    await route.fulfill({ response });
  });
}

test("admin editing stays readable and usable across narrow screens and themes", async ({
  page,
}) => {
  await authenticate(page);
  for (const theme of ["light", "dark"] as const) {
    await page.emulateMedia({ colorScheme: theme });
    await page.goto("/admin");
    const form = page.locator("form").filter({ has: page.locator('textarea[name="media"]') });
    const content = form.getByLabel("说说正文", { exact: true });
    await content.fill("中文排版与 English editing，缩放后保留输入。");
    await form
      .getByLabel("图片 / 语音 / 视频", { exact: false })
      .fill("audio /music/lu-xiaoyu.mp3 60s\nimage /films/secret/rain.jpg 100x100");
    await expect(form.getByRole("group", { name: "媒体预览", exact: true })).toBeVisible();

    for (const width of [320, 390, 768, 1280]) {
      await page.setViewportSize({ width, height: width < 640 ? 844 : 900 });
      await expect(content).toHaveValue("中文排版与 English editing，缩放后保留输入。");
      const layout = await page.evaluate(() => {
        const editor = document.querySelector('textarea[name="content"]')!;
        const label = document.querySelector("label[for]")!;
        const publish = Array.from(document.querySelectorAll("button")).find(
          (button) => button.textContent === "发布",
        )!;
        return {
          viewport: document.documentElement.clientWidth,
          page: document.documentElement.scrollWidth,
          inputSize: parseFloat(getComputedStyle(editor).fontSize),
          labelSize: parseFloat(getComputedStyle(label).fontSize),
          buttonHeight: publish.getBoundingClientRect().height,
          font: getComputedStyle(editor).fontFamily,
        };
      });
      expect(layout.page).toBeLessThanOrEqual(layout.viewport);
      expect(layout.inputSize).toBeGreaterThanOrEqual(16);
      expect(layout.labelSize).toBeGreaterThanOrEqual(14);
      expect(layout.buttonHeight).toBeGreaterThanOrEqual(44);
      expect(layout.font).toContain("FHFS Rounded SC");
      if (width === 390 || width === 1280)
        await page.screenshot({ path: `.e2e/admin-layout-${theme}-${width}.png`, fullPage: true });
    }

    await page.setViewportSize({ width: 390, height: 844 });
    await page.getByRole("button", { name: "板块", exact: true }).click();
    await expect(page.locator("#admin-drawer").getByRole("link", { name: /^说说/ })).toBeVisible();
    await page.getByRole("button", { name: "板块", exact: true }).press("Escape");
    await expect(page.getByRole("button", { name: "板块", exact: true })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await expect(content).toHaveValue("中文排版与 English editing，缩放后保留输入。");
  }

  for (const route of ["/admin/posts", "/admin/posts/new", "/admin/secrets/new"]) {
    await page.goto(route);
    await expect(page.getByRole("main").getByRole("heading", { level: 1 })).toBeVisible();
    for (const width of [320, 640, 768, 1280]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        await page.evaluate(() => document.documentElement.clientWidth),
      );
      if (route === "/admin/secrets/new")
        expect(
          await page.locator('input[name="slug"]').evaluate((input) => input.clientWidth),
        ).toBeGreaterThanOrEqual(144);
    }
  }
  await page.screenshot({ path: ".e2e/admin-layout-longform.png", fullPage: true });
});

const uploadPicture = {
  name: "e2e-picture.png",
  mimeType: "image/png",
  buffer: Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==",
    "base64",
  ),
};

test("scheduled cleanup removes abandoned and late uploads while keeping retained files", async ({
  request,
}) => {
  const response = await request.post("/api/media/cleanup", {
    headers: { authorization: `Bearer ${session.mediaSecret}` },
  });
  expect(response.ok()).toBe(true);
  expect(await response.json()).toEqual({ removed: 3 });
  for (const index of [1, 2, 3])
    expect(
      (
        await request.head(
          `http://127.0.0.1:8787/moments/uploads/00000000-0000-4000-8000-00000000000${index}.jpg`,
        )
      ).status(),
    ).toBe(404);
  expect(
    (
      await request.head(
        "http://127.0.0.1:8787/moments/uploads/00000000-0000-4000-8000-000000000004.jpg",
      )
    ).status(),
  ).toBe(200);
  const again = await request.post("/api/media/cleanup", {
    headers: { authorization: `Bearer ${session.mediaSecret}` },
  });
  expect(await again.json()).toEqual({ removed: 0 });
});

test("audio and video uploads fill duration, dimensions and a playable poster before publishing", async ({
  page,
}) => {
  test.setTimeout(90000);
  await localMedia(page);
  await authenticate(page);
  await page.goto("/admin");
  const form = page.locator("form").filter({ has: page.locator('textarea[name="media"]') });
  // A half-second of silence and a tiny generated colour clip, no external fixtures.
  const wave = Buffer.alloc(8044);
  wave.write("RIFF", 0);
  wave.writeUInt32LE(8036, 4);
  wave.write("WAVEfmt ", 8);
  wave.writeUInt32LE(16, 16);
  wave.writeUInt16LE(1, 20);
  wave.writeUInt16LE(1, 22);
  wave.writeUInt32LE(8000, 24);
  wave.writeUInt32LE(16000, 28);
  wave.writeUInt16LE(2, 32);
  wave.writeUInt16LE(16, 34);
  wave.write("data", 36);
  wave.writeUInt32LE(8000, 40);
  await form.getByLabel("选择上传的媒体文件", { exact: true }).setInputFiles([
    { name: "silence.wav", mimeType: "audio/wav", buffer: wave },
    {
      name: "clip.mp4",
      mimeType: "video/mp4",
      buffer: await readFile("tests/e2e/fixtures/upload-clip.mp4"),
    },
  ]);
  const field = form.locator('textarea[name="media"]');
  await expect(field).toHaveValue(/audio .*0\.5s\nvideo .*160x90 [0-9.]+s poster=https:/, {
    timeout: 75000,
  });
  const value = await field.inputValue();
  const gallery = form.getByRole("group", { name: "媒体预览", exact: true });
  await gallery.locator("video").evaluate(async (video: HTMLVideoElement) => {
    video.muted = true;
    await video.play();
  });
  await expect
    .poll(() => gallery.locator("video").evaluate((video: HTMLVideoElement) => video.videoWidth))
    .toBe(160);
  await form.screenshot({ path: ".e2e/admin-upload-preview.png" });
  await form.getByRole("button", { name: "取消本次编辑", exact: true }).click();
  for (const src of value.match(/https:\/\/[^\s]+/g) ?? []) {
    const path = new URL(src).pathname;
    await expect
      .poll(async () => (await page.request.head(`http://127.0.0.1:8787${path}`)).status())
      .toBe(404);
  }
});

test("selected uploads preview immediately and cancellation removes the staged file", async ({
  page,
}) => {
  await localMedia(page);
  await authenticate(page);
  await page.goto("/admin");
  const composer = page.locator("form").filter({ has: page.locator('textarea[name="media"]') });
  await composer.getByLabel("选择上传的媒体文件", { exact: true }).setInputFiles(uploadPicture);
  await expect(composer.locator('img[src^="blob:"]')).toBeVisible();
  const field = composer.locator('textarea[name="media"]');
  await expect(field).toHaveValue(/image https:.*\/moments\/uploads\//, { timeout: 75000 });
  const src = (await field.inputValue()).split(" ")[1]!;
  const local = `http://127.0.0.1:8787${new URL(src).pathname}`;
  expect((await page.request.head(local)).status()).toBe(200);
  await composer.getByRole("button", { name: "取消本次编辑", exact: true }).click();
  await expect(field).toHaveValue("");
  await expect.poll(async () => (await page.request.head(local)).status()).toBe(404);
});

test("saving a draft retains its upload against cancellation and reload", async ({ page }) => {
  await localMedia(page);
  await authenticate(page);
  let batch = "";
  page.on("request", (request) => {
    if (
      request.url().endsWith("/admin/media/uploads") &&
      request.postDataJSON()?.action === "start"
    )
      batch = (request.postDataJSON() as { batch: string }).batch;
  });
  await page.goto("/admin/moments");
  await page.getByRole("button", { name: "写一条", exact: true }).click();
  const form = page.locator("form").filter({ has: page.locator('textarea[name="media"]') });
  const key = `e2e-created-upload-${Date.now()}`;
  await form.locator('input[name="key"]').fill(key);
  await form.locator('textarea[name="content"]').fill("带媒体的草稿");
  await form.getByText("草稿", { exact: true }).click();
  await form.getByLabel("选择上传的媒体文件", { exact: true }).setInputFiles(uploadPicture);
  const field = form.locator('textarea[name="media"]');
  await expect(field).toHaveValue(/image https:.*\/moments\/uploads\//, { timeout: 75000 });
  const media = await field.inputValue();
  const src = media.split(" ")[1]!;
  await form.getByRole("button", { name: "保存", exact: true }).click();
  await expect(page.getByRole("main").getByRole("status")).toContainText("已保存");
  const cancelled = await page.request.post("/admin/media/uploads", {
    headers: { origin: "http://localhost:3100" },
    data: { action: "cancel", batch },
  });
  expect(cancelled.ok()).toBe(true);
  expect((await page.request.head(`http://127.0.0.1:8787${new URL(src).pathname}`)).status()).toBe(
    200,
  );
  await page.reload();
  await page.getByRole("searchbox", { name: "筛选这张表", exact: true }).fill(key);
  await page.getByRole("button", { name: /带媒体的草稿/ }).click();
  await expect(page.locator('textarea[name="media"]')).toHaveValue(media);
});

test("a cancelled upload cannot be saved by a stale editor", async ({ page }) => {
  await localMedia(page);
  await authenticate(page);
  await page.goto("/admin/moments");
  await page.getByRole("button", { name: "写一条", exact: true }).click();
  const form = page.locator("form").filter({ has: page.locator('textarea[name="media"]') });
  await form.locator('input[name="key"]').fill(`e2e-created-cancelled-${Date.now()}`);
  await form.locator('textarea[name="content"]').fill("取消后保留的正文");
  await form.getByLabel("选择上传的媒体文件", { exact: true }).setInputFiles(uploadPicture);
  const field = form.locator('textarea[name="media"]');
  await expect(field).toHaveValue(/image https:.*\/moments\/uploads\//, { timeout: 75000 });
  const old = await field.inputValue();
  await form.getByRole("button", { name: "移除并清理", exact: true }).click();
  await expect(field).toHaveValue("");
  await field.fill(old);
  await form.getByRole("button", { name: "保存", exact: true }).click();
  await expect(form.getByRole("alert")).toContainText("已被清理");
  await expect(form.locator('textarea[name="content"]')).toHaveValue("取消后保留的正文");
});

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
    expect(
      await (await visitor.request.get("http://localhost:3100/sitemap.xml")).text(),
    ).not.toContain("e2e-draft");
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

test("media previews follow unsaved files and keep valid previews beside an incomplete line", async ({
  page,
}) => {
  await authenticate(page);
  await page.goto("/admin/moments");
  await page.getByRole("button", { name: "写一条", exact: true }).click();
  const form = page.locator("form").filter({ has: page.locator('textarea[name="media"]') });
  const source = form.getByLabel("图片 / 语音 / 视频", { exact: false });
  const picture = "/films/secret/rain.jpg";
  const sound = "/music/lu-xiaoyu.mp3";
  const clip = `${MEDIA_ORIGIN}/moments/m-20231018-135059-1.mp4`;
  await form.locator('textarea[name="content"]').fill("仍未保存的说说");
  await source.fill(
    `image ${picture} 100x100\naudio ${sound} 60s\naudio /music/mia-and-sebastians-theme.mp3 60s\nvideo ${clip} 100x100 10s poster=${picture}`,
  );
  const gallery = form.getByRole("group", { name: "媒体预览", exact: true });
  const image = gallery.getByRole("img", { name: "图片预览：rain.jpg", exact: true });
  await expect(image).toHaveAttribute("src", asset(picture));
  await image.scrollIntoViewIfNeeded();
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBeGreaterThan(0);
  const audio = gallery.locator("audio").first();
  await expect(audio).toHaveAttribute("src", asset(sound));
  await audio.evaluate(async (element: HTMLAudioElement) => {
    element.muted = true;
    await element.play();
  });
  await expect
    .poll(() => audio.evaluate((element: HTMLAudioElement) => element.currentTime))
    .toBeGreaterThan(0);
  const secondAudio = gallery.locator("audio").last();
  await secondAudio.evaluate(async (element: HTMLAudioElement) => {
    element.muted = true;
    await element.play();
  });
  await expect.poll(() => audio.evaluate((element: HTMLAudioElement) => element.paused)).toBe(true);
  await secondAudio.evaluate((element: HTMLAudioElement) => element.pause());
  const video = gallery.locator("video");
  await expect(video).toHaveAttribute("poster", asset(picture));
  await expect(video).toHaveAttribute("controls", "");
  await expect(video).toHaveAttribute("preload", "none");
  await expect(video).not.toHaveAttribute("autoplay");
  await gallery.screenshot({ path: ".e2e/admin-media-preview.png" });
  await source.fill(`image ${picture} 100x100\nimage /unfinished.jpg`);
  await expect(image).toBeVisible();
  await expect(form.getByRole("status")).toContainText("第 2 行");
  await expect(form.locator('textarea[name="content"]')).toHaveValue("仍未保存的说说");
  await source.fill("image /films/missing.jpg 100x100");
  await expect(form.getByRole("status")).toContainText("无法预览");
  await expect(form.locator('textarea[name="content"]')).toHaveValue("仍未保存的说说");
  await source.fill(`image ${picture} 100x100`);
  await expect(image).toBeVisible();
  await form.evaluate((element: HTMLFormElement) => element.reset());
  await expect(source).toHaveValue("");
  await expect(gallery).toHaveCount(0);
});

test("podcast audio and picture rows show their files before saving", async ({ page }) => {
  await authenticate(page);
  await page.goto("/admin/secrets/new");
  const audio = "/music/lu-xiaoyu.mp3";
  await page.getByLabel("音频地址", { exact: false }).fill(audio);
  await expect(page.locator("audio")).toHaveAttribute("src", asset(audio));
  await page.goto("/admin/films");
  await page.getByRole("button", { name: "新电影", exact: true }).click();
  const pictures = page.getByRole("group", { name: /每一张/ });
  await pictures.getByRole("button", { name: "加一张", exact: true }).click();
  const picture = "/films/secret/rain.jpg";
  await pictures.locator('input[name="stills.0.src"]').fill(picture);
  await expect(pictures.getByRole("img")).toHaveAttribute("src", asset(picture));
  await expect(
    pictures.getByRole("link", { name: "查看原图：rain.jpg", exact: true }),
  ).toHaveAttribute("href", asset(picture));
  await pictures.getByRole("button", { name: "去掉这张", exact: true }).click();
  await expect(pictures.getByRole("img")).toHaveCount(0);
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

test("idol timeline rows retain bilingual fields through validation, reordering and draft preview", async ({
  page,
  browser,
}) => {
  const visitor = await browser.newContext();
  const key = `e2e-created-idol-${Date.now()}`;
  const name = { zh: `偶像表单验证 ${key}`, en: `Idol form ${key}` };
  try {
    await authenticate(page);
    await page.goto("/admin/idols");
    await page.getByRole("button", { name: "新偶像", exact: true }).click();
    await page.getByLabel("key（网址 /idols/…）", { exact: false }).fill(key);
    await page.locator('input[name="name.zh"]').fill(name.zh);
    await page.locator('input[name="name.en"]').fill(name.en);
    const timeline = page.getByRole("group", { name: /每一件事/ });
    for (const [index, date, title] of [
      [0, "2001.01", "第一件事"],
      [1, "2002.02", "第二件事"],
    ] as const) {
      await timeline.getByRole("button", { name: "加一条", exact: true }).click();
      await timeline.locator(`input[name="timeline.${index}.date"]`).fill(date);
      await timeline.locator(`input[name="timeline.${index}.title.zh"]`).fill(title);
      await timeline
        .locator(`input[name="timeline.${index}.title.en"]`)
        .fill(`Milestone ${index + 1}`);
      await timeline
        .locator(`textarea[name="timeline.${index}.note.zh"]`)
        .fill(`中文说明 ${index + 1}`);
    }
    await timeline.getByRole("button", { name: "下移", exact: true }).first().click();
    await timeline.getByRole("button", { name: "加一条", exact: true }).click();
    await timeline.locator('input[name="timeline.2.title.zh"]').fill("不应保存的第三件事");
    await timeline.getByRole("button", { name: "去掉这条", exact: true }).last().click();
    await page.locator('input[name="cover"]').fill("missing-photo");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("封面填的是照片的 id");
    await expect(timeline.locator('input[name="timeline.0.date"]')).toHaveValue("2002.02");
    await expect(timeline.locator('textarea[name="timeline.0.note.zh"]')).toHaveValue("中文说明 2");
    await page.locator('input[name="cover"]').fill("");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("已保存");
    await page.reload();
    await page.getByRole("button", { name: new RegExp(name.zh) }).click();
    await expect(page.locator('input[name="timeline.0.title.en"]')).toHaveValue("Milestone 2");
    await expect(page.locator('input[name="timeline.1.title.zh"]')).toHaveValue("第一件事");
    await expect(page.locator('input[name="timeline.2.title.zh"]')).toHaveCount(0);
    expect((await visitor.request.get(`http://localhost:3100/zh/idols/${key}`)).status()).toBe(404);
    await page.goto(`/admin/preview?kind=idol&slug=${key}&locale=en`);
    await expect(page.locator("main h1")).toHaveText(name.en);
    const milestones = page.locator("main ol li");
    await expect(milestones).toHaveCount(2);
    await expect(milestones.first()).toContainText("Milestone 2");
    await expect(milestones.first()).toContainText("中文说明 2");
    await page.goto("/admin/idols");
    await page.getByRole("button", { name: new RegExp(name.zh) }).click();
    await page.getByRole("button", { name: new RegExp(`删除这条.*${key}`) }).click();
    await page.getByRole("button", { name: "确认删除", exact: true }).click();
    await expect(page.getByRole("button", { name: new RegExp(name.zh) })).toHaveCount(0);
    expect((await page.goto(`/admin/preview?kind=idol&slug=${key}&locale=zh`))?.status()).toBe(404);
  } finally {
    await visitor.close();
  }
});

test("resume experience validation preserves input and saves invalidate resume and about", async ({
  page,
  browser,
}) => {
  const visitor = await browser.newContext({ baseURL: "http://localhost:3100" });
  const key = `e2e-created-resume-${Date.now()}`;
  const city = { zh: `测试城市 ${key}`, en: `Test City ${key}` };
  try {
    const publicPage = await visitor.newPage();
    await publicPage.goto("/zh/resume");
    await publicPage.goto("/zh/about");
    await authenticate(page);
    await page.goto("/admin/resume");
    const blank = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "新经历", exact: true }) });
    await blank.locator('input[name="key"]').fill(key);
    await blank.locator('input[name="company.zh"]').fill(city.zh);
    await blank.locator('input[name="company.en"]').fill(city.en);
    await blank.locator('input[name="role.zh"]').fill("保存前的职责");
    await blank.locator('input[name="period.zh"]').fill("2030 – 至今");
    await blank.locator('textarea[name="projects.zh"]').fill("缺少项目标题的文字");
    await blank.getByRole("button", { name: "保存", exact: true }).click();
    await expect(blank.getByRole("alert")).toContainText("zh 项目");
    await expect(blank.locator('input[name="company.zh"]')).toHaveValue(city.zh);
    await expect(blank.locator('textarea[name="projects.zh"]')).toHaveValue("缺少项目标题的文字");
    await blank
      .locator('textarea[name="projects.zh"]')
      .fill("# 集成验证 | 2030\n完成 **发布** 与 `恢复` 验证\n\n# 第二个项目\n第二项说明");
    await blank.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("已保存");
    await page.reload();
    const saved = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: key, exact: true }) });
    await expect(saved.locator('input[name="company.en"]')).toHaveValue(city.en);
    await expect(saved.locator('input[name="period.en"]')).toHaveValue("2030 – 至今");
    await expect(saved.locator('textarea[name="projects.zh"]')).toHaveValue(/# 集成验证 \| 2030/);
    await publicPage.goto("/zh/resume");
    const article = publicPage
      .locator("article")
      .filter({ has: publicPage.getByRole("heading", { name: city.zh, exact: true }) });
    await expect(article).toContainText("集成验证");
    await expect(article.locator("strong")).toHaveText("发布");
    await expect(article.locator("code")).toHaveText("恢复");
    await publicPage.goto("/en/resume");
    await expect(publicPage.getByRole("heading", { name: city.en, exact: true })).toBeVisible();
    await publicPage.goto("/zh/about");
    await expect(publicPage.getByText(city.zh, { exact: true })).toHaveCount(1);
    await expect(publicPage.getByText("保存前的职责", { exact: true })).toHaveCount(1);
    await saved.locator('input[name="role.zh"]').fill("更新后的职责");
    await saved.getByRole("button", { name: "保存", exact: true }).click();
    await expect(saved.getByRole("status")).toContainText("已保存");
    for (const route of ["/zh/resume", "/zh/about"]) {
      await publicPage.goto(route);
      await expect(publicPage.getByText("更新后的职责", { exact: true })).toHaveCount(1);
      await expect(publicPage.getByText("保存前的职责", { exact: true })).toHaveCount(0);
    }
    await saved.getByRole("button", { name: new RegExp(`删除这条.*${key}`) }).click();
    await page.getByRole("button", { name: "确认删除", exact: true }).click();
    await expect(page.getByRole("heading", { name: key, exact: true })).toHaveCount(0);
    for (const route of ["/zh/resume", "/zh/about"]) {
      await publicPage.goto(route);
      await expect(publicPage.getByText(city.zh, { exact: true })).toHaveCount(0);
    }
  } finally {
    await visitor.close();
  }
});

test("intro copy written in one language remains readable in the other language", async ({
  page,
  browser,
}) => {
  await authenticate(page);
  await page.goto("/admin/intro");
  await page.getByRole("button", { name: /FRONTEND/ }).click();
  const form = page.locator("form").filter({ has: page.locator('input[name="title.zh"]') });
  const names = ["kicker", "title", "period", "body", "bullets"].flatMap((field) => [
    `${field}.zh`,
    `${field}.en`,
  ]);
  const original = await Promise.all(
    names.map(async (name) => [name, await form.locator(`[name="${name}"]`).inputValue()] as const),
  );
  const visitor = await browser.newContext({
    baseURL: "http://localhost:3100",
    javaScriptEnabled: false,
  });
  try {
    const publicPage = await visitor.newPage();
    for (const [written, other] of [
      ["zh", "en"],
      ["en", "zh"],
    ] as const) {
      // Warm the public page before saving, so this also crosses cache invalidation.
      await publicPage.goto(`/${other}/intro`);
      for (const name of names) await form.locator(`[name="${name}"]`).fill("");
      const title = `Single-language intro ${written}`;
      await form.locator(`[name="title.${written}"]`).fill(title);
      await form.locator(`[name="kicker.${written}"]`).fill("Only one translation");
      await form.locator(`[name="period.${written}"]`).fill("2030 – present");
      await form.locator(`[name="body.${written}"]`).fill("A readable introduction.");
      await form.locator(`[name="bullets.${written}"]`).fill("One preserved bullet");
      if (written === "en") {
        const held = Promise.withResolvers<void>();
        await page.route("**/admin/intro", async (route) => {
          if (route.request().method() === "POST") await held.promise;
          await route.continue();
        });
        try {
          await form.getByRole("button", { name: "保存", exact: true }).click();
          await expect(form.getByRole("button", { name: "保存中…", exact: true })).toBeDisabled();
          await expect(form.getByRole("status")).toHaveCount(0);
        } finally {
          held.resolve();
        }
      } else {
        await form.getByRole("button", { name: "保存", exact: true }).click();
      }
      await expect(form.getByRole("button", { name: "保存", exact: true })).toBeEnabled();
      await expect(form.getByRole("status")).toContainText("已保存");
      await publicPage.reload();
      const document = publicPage.getByRole("region", {
        name: other === "en" ? en.intro.resumeRegion : zh.intro.resumeRegion,
        includeHidden: true,
      });
      await expect(document.getByRole("heading", { name: title, includeHidden: true })).toHaveCount(
        1,
      );
      await expect(document).toContainText("Only one translation");
      await expect(document).toContainText("2030 – present");
      await expect(document).toContainText("A readable introduction.");
      await expect(document).toContainText("One preserved bullet");
    }
  } finally {
    try {
      await expect(form.getByRole("button", { name: "保存", exact: true })).toBeEnabled();
      for (const [name, value] of original) await form.locator(`[name="${name}"]`).fill(value);
      await form.getByRole("button", { name: "保存", exact: true }).click();
      await expect(form.getByRole("button", { name: "保存", exact: true })).toBeEnabled();
      await expect(form.getByRole("status")).toContainText("已保存");
    } finally {
      await visitor.close();
    }
  }
});

test("a single-language timeline title and unknown date fall back on the public changelog", async ({
  page,
  browser,
}) => {
  const visitor = await browser.newContext({ baseURL: "http://localhost:3100" });
  const key = `e2e-created-timeline-${Date.now()}`;
  const title = `单语履历验证 ${key}`;
  try {
    const publicPage = await visitor.newPage();
    await publicPage.goto("/en/lab/changelog");
    await authenticate(page);
    await page.goto("/admin/timeline");
    await page.getByRole("button", { name: "新条目", exact: true }).click();
    await page.locator('input[name="key"]').fill(key);
    await page.locator('input[name="version"]').fill("e2e");
    await page.locator('input[name="dateLabel.zh"]').fill("时间待考");
    await page.locator('input[name="title.zh"]').fill(title);
    await page.locator('textarea[name="note.zh"]').fill("没有英文时仍可读取的说明");
    await page.getByRole("button", { name: "保存", exact: true }).click();
    await expect(page.getByRole("main").getByRole("status")).toContainText("已保存");
    await publicPage.reload();
    const entry = publicPage.locator("[data-entry]").filter({ hasText: title });
    await expect(entry.getByRole("heading", { name: title, exact: true })).toHaveCount(1);
    await expect(entry).toContainText("没有英文时仍可读取的说明");
    await expect(entry.getByRole("button", { name: /时间待考/ })).toHaveCount(1);
    await page.getByRole("button", { name: new RegExp(title) }).click();
    await page.getByRole("button", { name: new RegExp(`删除这条.*${key}`) }).click();
    await page.getByRole("button", { name: "确认删除", exact: true }).click();
    await expect(page.getByRole("button", { name: new RegExp(title) })).toHaveCount(0);
    await publicPage.reload();
    await expect(publicPage.getByText(title, { exact: true })).toHaveCount(0);
  } finally {
    await visitor.close();
  }
});
