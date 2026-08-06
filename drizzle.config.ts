import { defineConfig } from "drizzle-kit";

// drizzle-kit runs outside Next, so nothing has loaded .env.local for us.
try {
  process.loadEnvFile(".env.local");
} catch {
  // Fine in CI, where the variables are already in the environment.
}

/**
 * Migrations and seeding go through the *unpooled* connection: PgBouncer
 * breaks prepared statements, which DDL and bulk upserts rely on. The app
 * itself uses the pooled `DATABASE_URL` (see src/db/index.ts).
 */
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    "DATABASE_URL_UNPOOLED (preferred) or DATABASE_URL must be set to run migrations."
  );
}

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  // No `casing` option on purpose: every multi-word column in schema.ts names
  // itself explicitly, so there is no convention to keep in sync with the
  // runtime handle in src/db/index.ts.
  dbCredentials: { url },
});
