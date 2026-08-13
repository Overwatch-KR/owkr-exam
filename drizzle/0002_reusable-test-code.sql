DROP INDEX "attempt_code_once";--> statement-breakpoint
ALTER TABLE "exam_codes" ADD COLUMN "reusable" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "exam_codes" SET "reusable" = true, "status" = 'unused', "started_at" = NULL, "completed_at" = NULL WHERE "code" = 'IOWKRI';--> statement-breakpoint
CREATE INDEX "attempt_code_id_idx" ON "exam_attempts" USING btree ("code_id");
