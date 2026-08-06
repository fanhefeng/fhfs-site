CREATE TYPE "public"."app_category" AS ENUM('desktop', 'tool', 'game', 'website');--> statement-breakpoint
CREATE TYPE "public"."chip_tone" AS ENUM('paper', 'ink', 'accent');--> statement-breakpoint
CREATE TYPE "public"."experiment_status" AS ENUM('live', 'wip', 'planned');--> statement-breakpoint
CREATE TYPE "public"."locale" AS ENUM('zh', 'en');--> statement-breakpoint
CREATE TABLE "abouts" (
	"locale" "locale" PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"body_md" text NOT NULL,
	"body_html" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apps" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" text NOT NULL,
	"tagline" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"category" "app_category" NOT NULL,
	"icon" text,
	"website" text NOT NULL,
	"platforms" text[] DEFAULT '{}' NOT NULL,
	"accent" text,
	"hue" integer,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "apps_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "chips" (
	"id" serial PRIMARY KEY NOT NULL,
	"label" jsonb NOT NULL,
	"tone" "chip_tone" DEFAULT 'paper' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "copy_blocks" (
	"key" text PRIMARY KEY NOT NULL,
	"zh" text NOT NULL,
	"en" text NOT NULL,
	"note" text
);
--> statement-breakpoint
CREATE TABLE "experiments" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"name" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"status" "experiment_status" NOT NULL,
	"accent" text,
	"href" text,
	"demo" text,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "experiments_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "intro_nodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"kicker" jsonb NOT NULL,
	"title" jsonb NOT NULL,
	"period" jsonb,
	"body" jsonb NOT NULL,
	"bullets" jsonb NOT NULL,
	"sticker_label" text NOT NULL,
	"sticker_icon" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "intro_nodes_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "login_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"ip" text NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nav_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"href" text NOT NULL,
	"label_key" text NOT NULL,
	"surfaces" text[] DEFAULT '{}' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "posts" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"locale" "locale" NOT NULL,
	"title" text NOT NULL,
	"date" date NOT NULL,
	"summary" text NOT NULL,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"draft" boolean DEFAULT false NOT NULL,
	"cover" text,
	"body_md" text NOT NULL,
	"body_html" text NOT NULL,
	"reading_minutes" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "posts_slug_locale" UNIQUE("slug","locale")
);
--> statement-breakpoint
CREATE TABLE "site_settings" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"sign_name" text NOT NULL,
	"title" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"url" text NOT NULL,
	"author" text NOT NULL,
	"social" jsonb NOT NULL,
	CONSTRAINT "site_settings_singleton" CHECK ("site_settings"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "timeline_entries" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"version" text NOT NULL,
	"date" date,
	"date_label" jsonb,
	"title" jsonb NOT NULL,
	"note" jsonb NOT NULL,
	"sort" integer NOT NULL,
	CONSTRAINT "timeline_entries_key_unique" UNIQUE("key"),
	CONSTRAINT "timeline_has_date_or_label" CHECK ("timeline_entries"."date" IS NOT NULL OR "timeline_entries"."date_label" IS NOT NULL)
);
--> statement-breakpoint
CREATE TABLE "works" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"title" jsonb NOT NULL,
	"description" jsonb NOT NULL,
	"year" integer NOT NULL,
	"cover" text,
	"url" text,
	"tags" text[] DEFAULT '{}' NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "works_key_unique" UNIQUE("key")
);
