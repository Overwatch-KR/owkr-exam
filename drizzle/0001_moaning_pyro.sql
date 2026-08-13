ALTER TABLE "questions" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "updated_by_id" text;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "updated_by_name" text;