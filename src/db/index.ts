import { neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { withConnectionRetry } from "../lib/retryFetch";
import * as schema from "./schema";

/**
 * The database handle, over Neon's HTTP driver.
 *
 * HTTP rather than WebSocket because every read on this site is a single
 * SELECT, and one round-trip beats holding a connection open. Its one real
 * limitation — no multi-statement transactions — is designed around: tags are
 * an array column rather than a join table, so a save is always a single
 * upsert. If a genuine transaction ever becomes necessary, add a separate
 * `neon-serverless` handle for that action; the schema is shared.
 *
 * This module is imported by `generateStaticParams`, `sitemap.ts` and the OG
 * image routes, so it runs at build time too — the deploy environment needs
 * `DATABASE_URL` or the build fails. That is deliberate: failing loudly beats
 * shipping a site with no content in it.
 */
const url = process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL is not set. It is required at build time and at runtime — " +
      "pull it with `vercel env pull .env.local`, or copy the pooled " +
      "connection string from the Neon dashboard."
  );
}

/**
 * Every statement is one HTTP request, and the driver makes it with this
 * function: the global `fetch` — looked up per call, so the one Next has
 * instrumented is the one used — wrapped to try again when the connection
 * itself failed (src/lib/retryFetch.ts). That is the failure a proxied dev
 * network produces a few times an hour, and each one used to be a 500 on
 * whichever page was rendering. Retrying is safe here because everything
 * this site sends is a select, a keyed upsert, a keyed delete, or a
 * `db.batch()` that travels as a single request — none of them changes
 * anything when repeated. Keep the writes that way; a plain insert into a
 * serial-keyed table would not be.
 */
neonConfig.fetchFunction = withConnectionRetry((input, init) =>
  fetch(input, init)
);

export const db = drizzle(url, { schema });

export * from "./schema";
