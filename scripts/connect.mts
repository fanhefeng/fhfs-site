/**
 * The database handle the scripts share — what `src/db/index.ts` is for the
 * site, minus the parts that only make sense inside Next.
 *
 * Three things every script used to repeat, and had already let drift:
 * loading `.env.local`, preferring the unpooled connection string (drizzle-kit
 * says why: PgBouncer breaks the prepared statements bulk upserts rely on),
 * and surviving the odd fetch this network drops mid-handshake. The retry is
 * the same connection-level one the site wears (src/lib/retryFetch.ts), with
 * more patient delays — a script has nobody waiting on a page — and a line
 * on stderr each time, so a slow restore says what it is doing.
 */
import { neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "../src/db/schema";
import { withConnectionRetry } from "../src/lib/retryFetch";

const RETRY_DELAYS = [500, 1500, 4000, 8000];

export function connect() {
  try {
    process.loadEnvFile(".env.local");
  } catch {
    // Already in the environment.
  }

  const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL_UNPOOLED or DATABASE_URL must be set");

  neonConfig.fetchFunction = withConnectionRetry(
    (input, init) => fetch(input, init),
    RETRY_DELAYS,
    async (ms) => {
      console.warn(`connection failed, retrying in ${ms} ms…`);
      await new Promise((resolve) => setTimeout(resolve, ms));
    }
  );

  return drizzle(url, { schema });
}

export type Db = ReturnType<typeof connect>;
