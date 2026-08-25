import "server-only";
import { and, eq, gte, lt, sql } from "drizzle-orm";
import { db } from "@/db";
import { loginAttempts } from "@/db/schema";

/**
 * Login throttling, counted in a table rather than in memory.
 *
 * An in-memory counter resets whenever a new serverless instance picks up the
 * request — which is to say, precisely when someone is hammering the form.
 */

const WINDOW_MINUTES = 15;
const MAX_ATTEMPTS = 8;

const windowStart = () => new Date(Date.now() - WINDOW_MINUTES * 60_000);

/**
 * Records one attempt and, while it is here, drops everyone's expired rows —
 * between successful logins the table otherwise only ever grows.
 *
 * Two statements rather than one transaction: the HTTP driver has none, and
 * nothing here needs one. A prune that fails leaves rows the next attempt
 * will prune.
 */
export async function recordAttempt(ip: string): Promise<void> {
  await db.insert(loginAttempts).values({ ip });
  await db.delete(loginAttempts).where(lt(loginAttempts.at, windowStart()));
}

/**
 * True once this address has more attempts in the window than it is allowed.
 *
 * Call it *after* `recordAttempt`, so the count includes the attempt being
 * judged. Counting first and inserting second let a burst of concurrent
 * requests all read the same count and all get through. The eighth attempt
 * is the last one allowed; the ninth sees nine rows and is refused.
 */
export async function isThrottled(ip: string): Promise<boolean> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ip, ip), gte(loginAttempts.at, windowStart())));
  return (row?.count ?? 0) > MAX_ATTEMPTS;
}

/**
 * Called on a successful sign-in: forgets this address's window, so getting
 * it right on the eighth try does not lock the next session out.
 */
export async function clearAttempts(ip: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.ip, ip));
}
