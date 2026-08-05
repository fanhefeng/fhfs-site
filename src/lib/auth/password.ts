import { randomBytes, scryptSync, timingSafeEqual } from "node:crypto";

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

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, KEY_LENGTH).toString("hex");
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, hash] = stored.split(":");
  if (!salt || !hash) return false;

  const expected = Buffer.from(hash, "hex");
  const actual = scryptSync(password, salt, KEY_LENGTH);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
