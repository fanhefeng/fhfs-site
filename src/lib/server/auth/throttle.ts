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
 * Records one attempt and says whether this address has now made more of
 * them in the window than it is allowed. The eighth attempt is the last one
 * allowed; the ninth sees nine rows and is refused.
 *
 * Three statements in one `db.batch()` — a single HTTP request, run as one
 * transaction: the insert, a prune of everyone's expired rows (between
 * successful logins the table otherwise only ever grows), and the count.
 * Recording first and counting second is deliberate: counting first let a
 * burst of concurrent requests all read the same number and all get through.
 *
 * The insert is the one write on this site that is not idempotent, so a
 * connection-level retry (src/db/index.ts) that re-sends a batch whose reply
 * was lost can count one attempt twice. That only ever throttles *sooner*, and
 * a retry that lands twice at the login form is itself a rare event; the day
 * it matters, give attempts a client-generated id and `onConflictDoNothing`.
 */
export async function recordAttempt(ip: string): Promise<{ throttled: boolean }> {
  const [, , [row]] = await db.batch([
    db.insert(loginAttempts).values({ ip }),
    db.delete(loginAttempts).where(lt(loginAttempts.at, windowStart())),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(loginAttempts)
      .where(and(eq(loginAttempts.ip, ip), gte(loginAttempts.at, windowStart()))),
  ]);
  return { throttled: (row?.count ?? 0) > MAX_ATTEMPTS };
}

/**
 * Called on a successful sign-in: forgets this address's window, so getting
 * it right on the eighth try does not lock the next session out.
 */
export async function clearAttempts(ip: string): Promise<void> {
  await db.delete(loginAttempts).where(eq(loginAttempts.ip, ip));
}
