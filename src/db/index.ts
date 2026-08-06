import { drizzle } from "drizzle-orm/neon-http";
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

export const db = drizzle(url, { schema });

export * from "./schema";
