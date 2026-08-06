import "server-only";
import { and, eq, gte, lt, or, sql } from "drizzle-orm";
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

export async function recordAttempt(ip: string): Promise<void> {
  await db.insert(loginAttempts).values({ ip });
}

/** True when this address has burned through the window's allowance. */
export async function isThrottled(ip: string): Promise<boolean> {
  const since = new Date(Date.now() - WINDOW_MINUTES * 60_000);
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(loginAttempts)
    .where(and(eq(loginAttempts.ip, ip), gte(loginAttempts.at, since)));
  return (row?.count ?? 0) >= MAX_ATTEMPTS;
}

/**
 * Called on a successful sign-in: forgets this address's window — so getting
 * it right on the eighth try does not lock the next session out — and drops
 * everyone's expired rows while it is here.
 */
export async function clearAttempts(ip: string): Promise<void> {
  const cutoff = new Date(Date.now() - WINDOW_MINUTES * 60_000);
  await db
    .delete(loginAttempts)
    .where(or(eq(loginAttempts.ip, ip), lt(loginAttempts.at, cutoff)));
}
