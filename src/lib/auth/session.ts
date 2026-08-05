import "server-only";
import { cookies } from "next/headers";
import {
  createSession as signSession,
  readSession,
  MAX_AGE_SECONDS,
  SESSION_COOKIE,
  type Session,
} from "./token";

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
 * may not touch the database — and every Server Action calls `requireAdmin`
 * for the real one. Server Actions are not routes; a matcher edit or a moved
 * file can take them out from under the proxy without anything failing loudly.
 */

export async function createSession(): Promise<string> {
  return signSession();
}

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
 */
export async function requireAdmin(): Promise<Session> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await readSession(token);
  if (!session) throw new Error("Not authenticated");
  return session;
}
