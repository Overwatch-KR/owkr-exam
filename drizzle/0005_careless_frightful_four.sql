ALTER TABLE "exam_questions" ADD COLUMN "correct_answers" jsonb;--> statement-breakpoint
ALTER TABLE "questions" ADD COLUMN "correct_answers" jsonb;--> statement-breakpoint
UPDATE "exam_questions"
SET "correct_answers" = jsonb_build_array("correct_answer")
WHERE "correct_answer" IS NOT NULL;--> statement-breakpoint
UPDATE "questions"
SET "correct_answers" = jsonb_build_array("correct_answer")
WHERE "correct_answer" IS NOT NULL;
