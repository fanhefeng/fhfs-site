import { randomBytes, scrypt, scryptSync, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

/**
 * Password hashing, and nothing else.
 *
 * Deliberately free of `server-only` and of any database import: the CLI that
 * generates a hash (`pnpm admin:password`) runs outside Next and has to be
 * able to load this. Throttling, which does need both, lives in `throttle.ts`.
 *
 * The password is never stored — only `salt:hash` from scrypt. Comparison goes
 * through `timingSafeEqual`, so a wrong guess takes the same time to reject
 * however much of it happened to be right.
 */

const KEY_LENGTH = 64;

const scryptAsync = promisify(scrypt) as (
  password: string,
  salt: string,
  keylen: number,
) => Promise<Buffer>;

/** Minting a hash is `pnpm admin:password`, a CLI that does this once and
 *  exits — there is no event loop worth freeing there, so it stays synchronous. */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

/**
 * Checking one, on the other hand, happens inside a request. scrypt is
 * deliberately expensive — that is the point of it — and the synchronous call
 * spends that cost on the event loop, where it blocks every other request the
 * instance is serving. The threadpool version costs the same and blocks nobody.
 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = await scryptAsync(password, salt, KEY_LENGTH);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
