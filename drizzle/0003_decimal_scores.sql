ALTER TABLE "answers" ALTER COLUMN "score" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "exam_attempts" ALTER COLUMN "objective_score" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "exam_attempts" ALTER COLUMN "subjective_score" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "exam_attempts" ALTER COLUMN "total_score" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "exam_questions" ALTER COLUMN "points" SET DATA TYPE numeric(10, 2);--> statement-breakpoint
ALTER TABLE "questions" ALTER COLUMN "points" SET DATA TYPE numeric(10, 2);
