import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { readSession, MAX_AGE_SECONDS, SESSION_COOKIE, type Session } from "./token";

export { createSession } from "./token";

/**
 * Sessions, from the request's point of view.
 *
 * Everything here touches `cookies()`, which only exists inside a request. The
 * signing and verifying themselves live in `./token`, deliberately apart: the
 * proxy has to verify a token and must not import a module that reaches for
 * request-scoped APIs it cannot use.
 *
 * Note what this module does *not* do: authorise anything. The proxy performs
 * an optimistic check — it runs on every request, prefetches included, so it
 * may not touch the database — and the real one happens per entry point:
 * every Server Action calls `requireAdmin`, every admin page
 * `requireAdminPage`. Server Actions are not routes; a matcher edit or a
 * moved file can take them out from under the proxy without anything failing
 * loudly.
 */

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // `lax` rather than `strict`: a form POST followed by a redirect back into
    // /admin has to arrive with the cookie attached.
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SECONDS,
  });
}

export async function clearSessionCookie(): Promise<void> {
  (await cookies()).delete(SESSION_COOKIE);
}

/**
 * The real check, to be called at the top of every Server Action before it
 * touches anything. Throws rather than redirects so that forgetting to handle
 * the result cannot silently continue.
 *
 * For an action that reports back to a form, use `adminSession()` below
 * instead: a throw here reaches the client as a render error, and React
 * unmounts the form to show the error boundary — with the text the editor
 * had typed. A session that expired mid-edit should cost a second login, not
 * an article.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await adminSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

/**
 * The same check as a value: the session, or null once it has expired. The
 * form-reporting actions in `app/admin/actions.ts` start with
 * `if (!(await adminSession())) return SESSION_EXPIRED;` and hand the editor
 * a message beside the save button, keeping the form — and its contents — on
 * screen. Never call it without reading the result; that is what
 * `requireAdmin()` is for.
 */
export async function adminSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return readSession(token);
}

/**
 * The same check for admin pages, which render drafts and full table contents
 * and would otherwise rest entirely on the proxy's matcher. Redirects rather
 * than throws: an expired session on a bookmarked editor should land on the
 * login form, not an error page.
 */
export async function requireAdminPage(): Promise<Session> {
  const session = await adminSession();
  if (!session) redirect("/admin/login");
  return session;
}
