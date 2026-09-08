CREATE TYPE "public"."secret_kind" AS ENUM('essay', 'podcast');--> statement-breakpoint
CREATE TABLE "moments" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"content" text NOT NULL,
	"posted_at" timestamp with time zone NOT NULL,
	"collection" text,
	"original" boolean DEFAULT true NOT NULL,
	"attribution" text,
	"source" text,
	"mood" text,
	"draft" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "moments_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "secrets" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"locale" "locale" NOT NULL,
	"kind" "secret_kind" DEFAULT 'essay' NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"summary" text NOT NULL,
	"audio" text,
	"duration" integer,
	"draft" boolean DEFAULT false NOT NULL,
	"body_md" text NOT NULL,
	"body_html" text NOT NULL,
	"reading_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "secrets_slug_locale" UNIQUE("slug","locale")
);
