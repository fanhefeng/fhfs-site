ALTER TABLE "apps" ADD COLUMN "repo" text;--> statement-breakpoint
CREATE INDEX "login_attempts_ip_at" ON "login_attempts" USING btree ("ip","at");