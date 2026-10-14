import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { POST } from "@/app/api/github/webhook/route";

const state = vi.hoisted(() => ({ getApps: vi.fn(), revalidateTag: vi.fn() }));
vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/content", () => ({ getApps: state.getApps }));
vi.mock("next/cache", () => ({ revalidateTag: state.revalidateTag }));
const secret = "fake-webhook-secret-for-testing-only";

function request(
  event: string,
  body = JSON.stringify({ repository: { full_name: "fanhefeng/portreaper" } }),
) {
  return new Request("https://example.com/api/github/webhook", {
    method: "POST",
    body,
    headers: {
      "x-github-event": event,
      "x-hub-signature-256": `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`,
    },
  });
}

beforeEach(() => {
  state.getApps.mockReset().mockResolvedValue([{ repo: "FanHeFeng/Portreaper" }]);
  state.revalidateTag.mockReset();
  vi.stubEnv("GITHUB_WEBHOOK_SECRET", secret);
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GitHub webhook boundary", () => {
  it("keeps recovery windows on both pages even when no successful API cache exists", () => {
    for (const page of ["page.tsx", "software/page.tsx"]) {
      const source = readFileSync(new URL(`../../app/[locale]/${page}`, import.meta.url), "utf8");
      expect(source).toMatch(/export const revalidate = 3600;/);
    }
  });

  it("expires only the configured repository for releases, code, tags and stats", async () => {
    for (const event of ["release", "push", "create", "delete", "repository", "star", "fork"]) {
      const response = await POST(request(event));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, repo: "fanhefeng/portreaper" });
      expect(state.revalidateTag).toHaveBeenLastCalledWith("github:fanhefeng/portreaper", {
        expire: 0,
      });
    }
  });

  it("is idempotent on duplicate deliveries", async () => {
    await POST(request("release"));
    await POST(request("release"));
    expect(state.revalidateTag.mock.calls).toEqual([
      ["github:fanhefeng/portreaper", { expire: 0 }],
      ["github:fanhefeng/portreaper", { expire: 0 }],
    ]);
  });

  it("answers ping and ignores unrelated events without any database read", async () => {
    expect(await (await POST(request("ping"))).json()).toEqual({ ok: true });
    expect(await (await POST(request("issues"))).json()).toEqual({ ignored: true });
    expect(await (await POST(request("release", "{}"))).json()).toEqual({ ignored: true });
    expect(state.getApps).not.toHaveBeenCalled();
    expect(state.revalidateTag).not.toHaveBeenCalled();
  });

  it("does not invalidate a repository that is not on the site", async () => {
    expect(
      await (
        await POST(request("release", JSON.stringify({ repository: { full_name: "other/repo" } })))
      ).json(),
    ).toEqual({ ignored: true });
    expect(state.revalidateTag).not.toHaveBeenCalled();
  });

  it("rejects disabled, unsigned, tampered, invalid JSON and oversized requests", async () => {
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", "");
    expect((await POST(request("release"))).status).toBe(503);
    vi.stubEnv("GITHUB_WEBHOOK_SECRET", secret);
    expect(
      (await POST(new Request("https://example.com", { method: "POST", body: "{}" }))).status,
    ).toBe(401);
    const tampered = request("release");
    tampered.headers.set("x-hub-signature-256", `sha256=${"0".repeat(64)}`);
    expect((await POST(tampered)).status).toBe(401);
    expect((await POST(request("release", "not-json"))).status).toBe(400);
    const huge = request("release");
    huge.headers.set("content-length", String(26 * 1024 * 1024));
    expect((await POST(huge)).status).toBe(413);
    expect(state.getApps).not.toHaveBeenCalled();
    expect(state.revalidateTag).not.toHaveBeenCalled();
  });
});
