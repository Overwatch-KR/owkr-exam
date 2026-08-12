CREATE TABLE "answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_question_id" uuid NOT NULL,
	"value" text DEFAULT '' NOT NULL,
	"score" integer,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "exam_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code_id" uuid NOT NULL,
	"discord_id" text NOT NULL,
	"username" text NOT NULL,
	"display_name" text NOT NULL,
	"avatar" text,
	"started_at" timestamp NOT NULL,
	"expires_at" timestamp NOT NULL,
	"submitted_at" timestamp,
	"timed_out" boolean DEFAULT false NOT NULL,
	"objective_score" integer DEFAULT 0 NOT NULL,
	"subjective_score" integer,
	"total_score" integer
);
--> statement-breakpoint
CREATE TABLE "exam_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"discord_id" text NOT NULL,
	"status" text DEFAULT 'unused' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"started_at" timestamp,
	"completed_at" timestamp,
	CONSTRAINT "exam_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "exam_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"source_question_id" uuid,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"options" jsonb,
	"correct_answer" integer,
	"points" integer NOT NULL,
	"sort_order" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"content" text NOT NULL,
	"options" jsonb,
	"correct_answer" integer,
	"points" integer NOT NULL,
	"sort_order" integer NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "answers" ADD CONSTRAINT "answers_attempt_question_id_exam_questions_id_fk" FOREIGN KEY ("attempt_question_id") REFERENCES "public"."exam_questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_attempts" ADD CONSTRAINT "exam_attempts_code_id_exam_codes_id_fk" FOREIGN KEY ("code_id") REFERENCES "public"."exam_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exam_questions" ADD CONSTRAINT "exam_questions_attempt_id_exam_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."exam_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "answer_one_per_question" ON "answers" USING btree ("attempt_question_id");--> statement-breakpoint
CREATE UNIQUE INDEX "attempt_code_once" ON "exam_attempts" USING btree ("code_id");