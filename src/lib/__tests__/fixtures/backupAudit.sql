-- Isolated in-memory fixtures for the actual admin transaction boundary.
CREATE TABLE resume_experiences (
  id serial PRIMARY KEY, key text NOT NULL UNIQUE,
  company jsonb NOT NULL, role jsonb NOT NULL, period jsonb NOT NULL, bullets jsonb NOT NULL
);
CREATE TABLE posts (
  id serial PRIMARY KEY, slug text NOT NULL, locale text NOT NULL,
  title text NOT NULL, date date NOT NULL, summary text NOT NULL,
  body_md text NOT NULL, body_html text NOT NULL, reading_minutes integer NOT NULL,
  draft boolean NOT NULL DEFAULT false
);
CREATE TABLE "admin_content_state" (
	"table_name" text PRIMARY KEY NOT NULL,
	"total_rows" integer NOT NULL,
	"public_rows" integer NOT NULL,
	"revision" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_content_state_counts" CHECK ("admin_content_state"."total_rows" >= "admin_content_state"."public_rows" AND "admin_content_state"."public_rows" >= 0)
);
