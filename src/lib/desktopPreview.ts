import type { Locale } from "@/i18n/routing";

// Explicit opt-in: previews must never replace the stable release or other apps.
export function desktopPreview(repo: string | null, locale: Locale) {
  if (repo?.toLowerCase() !== "fanhefeng/file-tidy") return undefined;
  const zh = locale === "zh";
  return {
    title: zh ? "桌面预览版 0.5.4" : "Desktop preview 0.5.4",
    description: zh
      ? "仅适用于 macOS Apple Silicon（M 系列）。未使用 Apple Developer ID 签名，未公证，macOS 可能阻止打开。此为测试版；CLI 和 Raycast 版本仍可照常使用。"
      : "For macOS Apple Silicon (M-series) only. Not signed with Apple Developer ID or notarized; macOS may block opening it. This is a preview; the CLI and Raycast versions remain available.",
    downloadLabel: zh ? "下载 macOS 预览版（DMG）" : "Download macOS preview (DMG)",
    notesLabel: zh ? "版本说明与校验值" : "Release notes and checksums",
    downloadUrl:
      "https://github.com/fanhefeng/file-tidy/releases/download/desktop-v0.5.4/File.Tidy-0.5.4-arm64.dmg",
    releaseUrl: "https://github.com/fanhefeng/file-tidy/releases/tag/desktop-v0.5.4",
  };
}
