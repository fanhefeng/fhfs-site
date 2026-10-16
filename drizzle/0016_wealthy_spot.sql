CREATE TABLE "media_uploads" (
	"id" text PRIMARY KEY NOT NULL,
	"batch" text NOT NULL,
	"path" text NOT NULL,
	"size" integer NOT NULL,
	"content_type" text NOT NULL,
	"state" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "media_uploads_path_unique" UNIQUE("path")
);
--> statement-breakpoint
CREATE INDEX "media_uploads_batch" ON "media_uploads" USING btree ("batch");--> statement-breakpoint
CREATE INDEX "media_uploads_state" ON "media_uploads" USING btree ("state");