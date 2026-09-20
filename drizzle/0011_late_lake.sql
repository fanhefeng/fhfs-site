ALTER TABLE "copy_blocks" ALTER COLUMN "zh" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "copy_blocks" ALTER COLUMN "en" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "copy_blocks" DROP COLUMN "note";