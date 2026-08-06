import { jwtVerify, SignJWT } from "jose";

/**
 * Signing and verifying the admin session, with no request attached.
 *
 * Kept apart from `session.ts` because the proxy imports this: the proxy runs
 * before a route does and cannot use `cookies()`, so it must not load a module
 * that reaches for one. `jose` runs on Web Crypto, so the same verification
 * works in the proxy and inside a Server Action.
 *
 * The session is a signed JWT rather than a row. There is exactly one account,
 * so a sessions table would buy nothing but a query on every request.
 */

export const SESSION_COOKIE = "fhfs_admin";
export const MAX_AGE_SECONDS = 60 * 60 * 8;

export type Session = { sub: string };

function secret(): Uint8Array {
  const value = process.env.AUTH_SECRET;
  if (!value) throw new Error("AUTH_SECRET is not set");
  return new TextEncoder().encode(value);
}

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
