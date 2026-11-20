import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { DrizzleQueryError } from "drizzle-orm/errors";
import bundled from "../../../backup/db.json";
import { unstable_cache } from "../server/snapshotCache";
import { snapshotContent } from "../server/snapshotContent";
import { parsePublicSnapshot, readPublicSnapshot } from "../server/snapshotSource";
import { showDrafts } from "../server/auth/session";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("../server/auth/session", () => ({ showDrafts: vi.fn() }));
vi.mock("../server/snapshotSource", async (original) => ({
  ...(await original<typeof import("../server/snapshotSource")>()),
  readPublicSnapshot: vi.fn(),
}));

const publishedAt = "2026-10-04T11:36:13Z";
const outage = new DrizzleQueryError(
  "SELECT PRIVATE-SQL",
  [],
  Object.assign(new Error("Server error (HTTP status 402): quota exceeded"), {
    name: "NeonDbError",
  }),
);
const options = { tags: ["posts"], revalidate: 30 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(showDrafts).mockResolvedValue(false);
  vi.mocked(readPublicSnapshot).mockResolvedValue(parsePublicSnapshot(publishedAt, bundled));
});

describe("public snapshot", () => {
  it("keeps the cache on live data and retries after an outage", async () => {
    const read = vi
      .fn<() => Promise<string>>()
      .mockRejectedValueOnce(outage)
      .mockResolvedValue("live");
    const getter = unstable_cache(read, ["post"], options, (snapshot) => snapshot.publishedAt);
    await expect(getter()).resolves.toBe(publishedAt);
    await expect(getter()).resolves.toBe("live");
    expect(readPublicSnapshot).toHaveBeenCalledTimes(1);
  });

  it("keeps authenticated previews, unrelated failures and snapshot misses out of fallback", async () => {
    const read = vi.fn<() => Promise<string>>().mockRejectedValue(outage);
    const getter = unstable_cache(read, ["post"], options, () => "fallback");
    vi.mocked(showDrafts).mockResolvedValueOnce(true);
    await expect(getter()).rejects.toBe(outage);
    const bug = new Error("render bug");
    read.mockRejectedValueOnce(bug);
    await expect(getter()).rejects.toBe(bug);
    expect(readPublicSnapshot).not.toHaveBeenCalled();
    const missing = unstable_cache(read, ["missing"], options, () => undefined);
    await expect(missing()).rejects.toBe(outage);
  });

  it("renders the same published edition without exposing draft fields", async () => {
    const snapshot = await readPublicSnapshot();
    const first = snapshotContent.posts(snapshot, "en")[0]!;
    const post = snapshotContent.post(snapshot, first.slug, "en");
    expect(post).toMatchObject({ slug: first.slug, snapshotAt: publishedAt });
    expect(post?.html).toBeTruthy();
    expect(post).not.toHaveProperty("draft");
    expect(snapshotContent.post(snapshot, first.slug, "en", true)).toBeUndefined();
  });
});
