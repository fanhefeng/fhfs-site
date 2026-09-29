import { draftMode } from "next/headers";
import { redirect } from "next/navigation";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { adminSession } from "@/lib/server/auth/session";
import { validKey } from "@/lib/forms";

/** Which room a long-form piece hangs in, by the kind the editor sends. */
const ROOMS = { post: "blog", secret: "secrets" } as const;

/**
 * "See it on the site": turns on Next's Draft Mode for this browser and goes
 * to the piece's own page. With the mode on, every cached read is bypassed and
 * the article and secret pages ask for drafts too, so the page shows the last
 * save — draft or not — exactly as it will read once published. Everyone else
 * keeps getting the prerendered page.
 *
 * The cookie Draft Mode sets is a secret minted by each build, so it cannot be
 * made by hand; this handler is the only way to get one, and it checks the
 * session first. The address it redirects to is built from the validated
 * parts, never passed through.
 */
export async function GET(request: Request) {
  if (!(await adminSession())) redirect("/admin/login");

  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  const slug = params.get("slug") ?? "";
  const locale = params.get("locale");
  if (
    (kind !== "post" && kind !== "secret") ||
    !validKey(slug) ||
    !hasLocale(routing.locales, locale)
  ) {
    return new Response("Bad Request", { status: 400 });
  }

  (await draftMode()).enable();
  redirect(`/${locale}/${ROOMS[kind]}/${slug}`);
}
