CREATE TABLE "admin_content_state" (
	"table_name" text PRIMARY KEY NOT NULL,
	"total_rows" integer NOT NULL,
	"public_rows" integer NOT NULL,
	"revision" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "admin_content_state_counts" CHECK ("admin_content_state"."total_rows" >= "admin_content_state"."public_rows" AND "admin_content_state"."public_rows" >= 0)
);

--> statement-breakpoint
-- CI can inspect expected counts but cannot forge an authenticated edit.
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ci_readonly') THEN
    GRANT SELECT ON public.admin_content_state TO ci_readonly;
  END IF;
END $$;
