/** Keep the feature probe cheap: unsupported visitors never fetch the renderer. */
export function supportsHtmlInCanvas(): boolean {
  const canvas = document.createElement("canvas");
  if (!("requestPaint" in canvas)) return false;
  // Chrome's original trial used layoutsubtree. The shipped API uses
  // content="drawable" and explicit geometry updates instead of CSS transforms.
  canvas.setAttribute("content", "drawable");
  return ("content" in canvas && canvas.content === "drawable") || "layoutSubtree" in canvas;
}
