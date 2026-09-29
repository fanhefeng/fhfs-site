import { adminSession } from "@/lib/server/auth/session";
import { renderMarkdown } from "@/lib/server/markdown";

/**
 * The editor's preview: markdown in, the HTML a save would store out. It is
 * the save's own pipeline (`renderMarkdown`), not a second renderer in the
 * browser, so what the preview shows is what the page will. Writes nothing,
 * which is why it is a route and not a Server Action — the actions in
 * `../../actions/` all end by invalidating what they wrote.
 */
export async function POST(request: Request) {
  if (!(await adminSession())) return new Response("Unauthorized", { status: 401 });
  const html = await renderMarkdown(await request.text());
  return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}
