import "server-only";
import { cookies } from "next/headers";
import { jwtVerify, SignJWT } from "jose";

/**
 * One user, one cookie.
 *
 * The session is a signed JWT rather than a row: there is exactly one account,
 * so a sessions table would buy nothing but a query on every request. `jose`
 * runs on Web Crypto, which means the same code verifies in the proxy and in a
 * Server Action.
 *
 * Note what this module deliberately does *not* do: authorise anything. The
 * proxy uses `readSession` for an optimistic check — it runs on every request,
 * including prefetches, so it may not touch the database — and every Server
 * Action calls `requireAdmin` for the real one. Server Actions are not routes;
 * a matcher edit or a moved file can take them out from under the proxy
 * without anything failing loudly.
 */

const COOKIE = "fhfs_admin";
const MAX_AGE_SECONDS = 60 * 60 * 8;

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(value);
}

export type Session = { sub: string };

export async function createSession(): Promise<string> {
  return new SignJWT({ sub: "admin" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(secret());
}

/** Verifies a token's signature and expiry. No database, no side effects. */
export async function readSession(
  token: string | undefined
): Promise<Session | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload.sub === "admin" ? { sub: payload.sub } : null;
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string): Promise<void> {
  (await cookies()).set(COOKIE, token, {
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
  (await cookies()).delete(COOKIE);
}

export async function currentSession(): Promise<Session | null> {
  return readSession((await cookies()).get(COOKIE)?.value);
}

/**
 * The real check, to be called at the top of every Server Action before it
 * touches anything. Throws rather than redirects so that forgetting to handle
 * the result cannot silently continue.
 */
export async function requireAdmin(): Promise<Session> {
  const session = await currentSession();
  if (!session) throw new Error("Not authenticated");
  return session;
}

export const SESSION_COOKIE = COOKIE;
