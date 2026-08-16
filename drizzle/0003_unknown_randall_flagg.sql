CREATE TABLE "resume_experiences" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"company" jsonb NOT NULL,
	"role" jsonb NOT NULL,
	"period" jsonb NOT NULL,
	"url" text,
	"bullets" jsonb NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "resume_experiences_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "resume_profiles" (
	"key" text PRIMARY KEY NOT NULL,
	"name" jsonb NOT NULL,
	"tagline" jsonb NOT NULL,
	"intro" jsonb NOT NULL,
	"email" text,
	"github" text,
	"location" jsonb,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
