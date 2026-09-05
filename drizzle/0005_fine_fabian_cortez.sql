ALTER TABLE "resume_experiences" ADD COLUMN "summary" jsonb;--> statement-breakpoint
ALTER TABLE "resume_experiences" ADD COLUMN "projects" jsonb DEFAULT '{"zh":[],"en":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_profiles" ADD COLUMN "highlights" jsonb DEFAULT '{"zh":[],"en":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_profiles" ADD COLUMN "skills" jsonb DEFAULT '{"zh":[],"en":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_profiles" ADD COLUMN "projects" jsonb DEFAULT '{"zh":[],"en":[]}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "resume_profiles" ADD COLUMN "education" jsonb DEFAULT '{"zh":[],"en":[]}'::jsonb NOT NULL;