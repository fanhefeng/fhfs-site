import { describe, expect, it } from "vite-plus/test";
import { desktopPreview } from "@/lib/desktopPreview";

describe("explicit desktop preview", () => {
  it("never adds File Tidy downloads to another project", () => {
    expect(desktopPreview("fanhefeng/photo-browser", "zh")).toBeUndefined();
    expect(desktopPreview(null, "en")).toBeUndefined();
  });
  it("labels the platform and signing limitations in both languages", () => {
    const zh = desktopPreview("fanhefeng/file-tidy", "zh")!;
    const en = desktopPreview("FanHeFeng/File-Tidy", "en")!;
    expect(zh.title).toContain("预览版");
    expect(zh.description).toContain("未公证");
    expect(en.title).toContain("preview");
    expect(en.description).toContain("notarized");
    for (const preview of [zh, en]) {
      expect(preview.description).toContain("Apple Silicon");
      expect(preview.description).toContain("Raycast");
      expect(preview.downloadUrl).toBe(
        "https://github.com/fanhefeng/file-tidy/releases/download/desktop-v0.5.3/File.Tidy-0.5.3-arm64.dmg",
      );
      expect(preview.releaseUrl).toContain("/releases/tag/desktop-v0.5.3");
    }
  });
});
